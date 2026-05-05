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

async function ensureInit(): Promise<void> {
  if (!global.__bagDbInit) {
    global.__bagDbInit = (async () => {
      const c = getClient();
      await c.batch(
        [
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
          `CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            ticker TEXT NOT NULL,
            buy_price REAL NOT NULL,
            current_price REAL NOT NULL,
            quantity REAL,
            comment TEXT NOT NULL DEFAULT '',
            pnl_pct REAL NOT NULL,
            created_at INTEGER NOT NULL
          )`,
          `CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)`,
          `CREATE TABLE IF NOT EXISTS reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(post_id, user_id, kind)
          )`,
          `CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id)`,
        ],
        "deferred",
      );
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
  category: string;
  ticker: string;
  buy_price: number;
  current_price: number;
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
