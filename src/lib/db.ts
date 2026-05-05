import { DatabaseSync, type StatementSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "bagholders.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

declare global {
  // eslint-disable-next-line no-var
  var __bagholdersDb: DatabaseSync | undefined;
}

function init(d: DatabaseSync) {
  d.exec("PRAGMA journal_mode = WAL");
  d.exec("PRAGMA foreign_keys = ON");

  d.exec(`
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

function getDb(): DatabaseSync {
  if (!global.__bagholdersDb) {
    const d = new DatabaseSync(DB_PATH);
    init(d);
    global.__bagholdersDb = d;
  }
  return global.__bagholdersDb;
}

type SqlValue = string | number | bigint | null | Uint8Array;

type PreparedStatement = {
  run: (...params: SqlValue[]) => { lastInsertRowid: number | bigint; changes: number };
  get: <T = unknown>(...params: SqlValue[]) => T | undefined;
  all: <T = unknown>(...params: SqlValue[]) => T[];
};

export const db = {
  prepare(sql: string): PreparedStatement {
    const stmt = getDb().prepare(sql) as StatementSync;
    return {
      run: (...params: SqlValue[]) =>
        stmt.run(...(params as Parameters<StatementSync["run"]>)) as {
          lastInsertRowid: number | bigint;
          changes: number;
        },
      get: <T,>(...params: SqlValue[]) =>
        stmt.get(...(params as Parameters<StatementSync["get"]>)) as T | undefined,
      all: <T,>(...params: SqlValue[]) =>
        stmt.all(...(params as Parameters<StatementSync["all"]>)) as T[],
    };
  },
  exec(sql: string) {
    return getDb().exec(sql);
  },
};

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
