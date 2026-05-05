import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "bagholders.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

declare global {
  // eslint-disable-next-line no-var
  var __bagholdersDb: Database.Database | undefined;
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
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
    );
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);

    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(post_id, user_id, kind)
    );
    CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);
  `);
}

function getDb(): Database.Database {
  if (!global.__bagholdersDb) {
    const db = new Database(DB_PATH);
    init(db);
    global.__bagholdersDb = db;
  }
  return global.__bagholdersDb;
}

export const db = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

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
