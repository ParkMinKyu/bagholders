import { createClient, type Client, type InValue } from "@libsql/client";
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

const SCHEMA_VERSION = 3;

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
      if (current < SCHEMA_VERSION) {
        stmts.push("DROP TABLE IF EXISTS reactions", "DROP TABLE IF EXISTS posts");
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
      );

      await c.batch(stmts, "deferred");

      if (current < SCHEMA_VERSION) {
        await c.execute({
          sql: "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('posts_version', ?)",
          args: [SCHEMA_VERSION],
        });
      }
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
  created_at: number;
};

export type ReactionRow = {
  id: number;
  post_id: number;
  user_id: number;
  kind: string;
  created_at: number;
};
