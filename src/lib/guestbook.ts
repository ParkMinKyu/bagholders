import { dbAll, dbGet, dbRun } from "./db";

export const GUESTBOOK_MAX = 500;

export type GuestbookEntry = {
  id: number;
  owner_id: number;
  author_id: number;
  author_username: string;
  body: string;
  created_at: number;
};

export async function listGuestbook(
  ownerId: number,
  limit = 100,
): Promise<GuestbookEntry[]> {
  const rows = await dbAll<{
    id: number;
    owner_id: number;
    author_id: number;
    author_username: string;
    body: string;
    created_at: number;
  }>(
    `SELECT g.id, g.owner_id, g.author_id, u.username AS author_username, g.body, g.created_at
     FROM guestbook_entries g
     JOIN users u ON u.id = g.author_id
     WHERE g.owner_id = ?
     ORDER BY g.created_at DESC
     LIMIT ?`,
    [ownerId, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    owner_id: Number(r.owner_id),
    author_id: Number(r.author_id),
    author_username: r.author_username,
    body: r.body,
    created_at: Number(r.created_at),
  }));
}

export async function getGuestbookCount(ownerId: number): Promise<number> {
  const row = await dbGet<{ n: number }>(
    "SELECT COUNT(*) AS n FROM guestbook_entries WHERE owner_id = ?",
    [ownerId],
  );
  return Number(row?.n ?? 0);
}

export async function addGuestbookEntry(
  ownerId: number,
  authorId: number,
  body: string,
): Promise<{ id: number } | null> {
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  const truncated = trimmed.slice(0, GUESTBOOK_MAX);
  const r = await dbRun(
    `INSERT INTO guestbook_entries (owner_id, author_id, body, created_at)
     VALUES (?, ?, ?, ?)`,
    [ownerId, authorId, truncated, Date.now()],
  );
  return { id: r.lastInsertRowid };
}
