import { createClient, type Client, type InValue } from "@libsql/client";

export type { InValue };
import path from "node:path";
import fs from "node:fs";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

function resolveLocalUrl(): string {
  const dir = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return `file:${path.join(dir, "bagholders.db")}`;
  } catch {
    return `file:/tmp/bagholders.db`;
  }
}

const url = tursoUrl && tursoUrl.length > 0 ? tursoUrl : resolveLocalUrl();

declare global {
  // eslint-disable-next-line no-var
  var __bagDbClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __bagDbInit: Promise<void> | undefined;
}

function getClient(): Client {
  if (!global.__bagDbClient) {
    global.__bagDbClient = createClient({ url, authToken });
  }
  return global.__bagDbClient;
}

const SCHEMA_VERSION = 10;

async function ensureInit(): Promise<void> {
  if (!global.__bagDbInit) {
    global.__bagDbInit = (async () => {
      const c = getClient();

      // Fast path: 단일 SELECT로 schema가 최신인지 확인. 최신이면 추가 DDL 생략.
      let current = 0;
      try {
        const ver = await c.execute({
          sql: "SELECT value FROM schema_meta WHERE key = 'posts_version'",
          args: [],
        });
        current = (ver.rows[0]?.value as number | undefined) ?? 0;
        if (current === SCHEMA_VERSION) return;
      } catch {
        // schema_meta가 아직 없음 → 풀 init 진행
      }

      // Cold path: 모든 DDL을 단일 batch에 묶어 1회 round-trip으로 실행.
      const stmts: string[] = [
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          bio TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS schema_meta (
          key TEXT PRIMARY KEY,
          value INTEGER NOT NULL
        )`,
      ];
      // 레거시 posts/reactions 스키마(v1, v2)에서만 재생성 — v3 이후는 데이터 보존.
      if (current > 0 && current < 3) {
        stmts.push("DROP TABLE IF EXISTS reactions", "DROP TABLE IF EXISTS posts");
      }
      // v6: 기존 v3~v5 posts 테이블에 image_url 컬럼 추가.
      // 신규 설치(current === 0)나 재생성(<v3)은 아래 CREATE TABLE에 이미 포함됨.
      if (current >= 3 && current < 6) {
        stmts.push("ALTER TABLE posts ADD COLUMN image_url TEXT");
      }
      stmts.push(
        `CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          asset_type TEXT NOT NULL,
          ticker_code TEXT NOT NULL,
          ticker_symbol TEXT NOT NULL,
          ticker_name TEXT NOT NULL,
          entry_price REAL NOT NULL,
          last_price REAL NOT NULL,
          last_priced_at INTEGER NOT NULL,
          quantity REAL,
          comment TEXT NOT NULL DEFAULT '',
          pnl_pct REAL NOT NULL,
          image_url TEXT,
          created_at INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_posts_ticker ON posts(ticker_code)`,
        `CREATE TABLE IF NOT EXISTS reactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE(post_id, user_id, kind)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id)`,
        // v4: 팔로우 테이블 (v3 → v4는 순수 추가, 기존 데이터 보존).
        `CREATE TABLE IF NOT EXISTS follows (
          follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (follower_id, following_id)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)`,
        `CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)`,
        // v5: 코인 즐겨찾기 (additive — symbol/name은 작성 시점 스냅샷).
        `CREATE TABLE IF NOT EXISTS coin_favorites (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          ticker_code TEXT NOT NULL,
          ticker_symbol TEXT NOT NULL,
          ticker_name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, ticker_code)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_coin_favs_user ON coin_favorites(user_id, created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_coin_favs_ticker ON coin_favorites(ticker_code)`,
        // v7: 코멘트 테이블 (additive).
        `CREATE TABLE IF NOT EXISTS comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          body TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)`,
        // v8: 방명록 (additive). owner=프로필 주인, author=글쓴이.
        `CREATE TABLE IF NOT EXISTS guestbook_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          body TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_guestbook_owner ON guestbook_entries(owner_id, created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_guestbook_author ON guestbook_entries(author_id)`,
        // v9: 갤러리(자유 게시판). 익명 닉네임 컬럼 포함, vote count는 denormalize.
        `CREATE TABLE IF NOT EXISTS board_posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          anon_nickname TEXT,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          image_url TEXT,
          upvotes INTEGER NOT NULL DEFAULT 0,
          downvotes INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_board_created ON board_posts(created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_board_category ON board_posts(category, created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_board_score ON board_posts(upvotes DESC, created_at DESC)`,
        `CREATE TABLE IF NOT EXISTS board_votes (
          post_id INTEGER NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (post_id, user_id)
        )`,
        `CREATE TABLE IF NOT EXISTS board_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          anon_nickname TEXT,
          body TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS idx_board_comments_post ON board_comments(post_id, created_at ASC)`,
        // v10: 신고 테이블 (additive). 같은 유저가 같은 대상 중복 신고 차단.
        `CREATE TABLE IF NOT EXISTS reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_type TEXT NOT NULL,
          target_id INTEGER NOT NULL,
          reason TEXT NOT NULL,
          body TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          UNIQUE(reporter_id, target_type, target_id)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id)`,
      );

      await c.batch(stmts, "deferred");

      await c.execute({
        sql: "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('posts_version', ?)",
        args: [SCHEMA_VERSION],
      });
    })();
  }
  await global.__bagDbInit;
}

export async function dbAll<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = [],
): Promise<T[]> {
  await ensureInit();
  const r = await getClient().execute({ sql, args });
  return r.rows as unknown as T[];
}

export async function dbGet<T = Record<string, unknown>>(
  sql: string,
  args: InValue[] = [],
): Promise<T | undefined> {
  const rows = await dbAll<T>(sql, args);
  return rows[0];
}

export async function dbRun(
  sql: string,
  args: InValue[] = [],
): Promise<{ lastInsertRowid: number; changes: number }> {
  await ensureInit();
  const r = await getClient().execute({ sql, args });
  return {
    lastInsertRowid: Number(r.lastInsertRowid ?? 0),
    changes: r.rowsAffected,
  };
}

export async function dbBatch(
  stmts: { sql: string; args: InValue[] }[],
): Promise<void> {
  if (stmts.length === 0) return;
  await ensureInit();
  await getClient().batch(stmts, "deferred");
}

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  bio: string;
  created_at: number;
};

export type PostRow = {
  id: number;
  user_id: number;
  kind: "buy_high" | "sell_low";
  asset_type: "crypto";
  ticker_code: string;
  ticker_symbol: string;
  ticker_name: string;
  entry_price: number;
  last_price: number;
  last_priced_at: number;
  quantity: number | null;
  comment: string;
  pnl_pct: number;
  image_url: string | null;
  created_at: number;
};

export type ReactionRow = {
  id: number;
  post_id: number;
  user_id: number;
  kind: string;
  created_at: number;
};

export type FollowRow = {
  follower_id: number;
  following_id: number;
  created_at: number;
};

export type CommentRow = {
  id: number;
  post_id: number;
  user_id: number;
  body: string;
  created_at: number;
};
