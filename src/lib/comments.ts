import { dbAll, dbRun } from "./db";

export const COMMENT_MAX = 500;

export type CommentRow = {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  body: string;
  created_at: number;
};

export async function listComments(
  postId: number,
  limit = 200,
): Promise<CommentRow[]> {
  const rows = await dbAll<{
    id: number;
    post_id: number;
    user_id: number;
    username: string;
    body: string;
    created_at: number;
  }>(
    `SELECT c.id, c.post_id, c.user_id, u.username, c.body, c.created_at
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC
     LIMIT ?`,
    [postId, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    post_id: Number(r.post_id),
    user_id: Number(r.user_id),
    username: r.username,
    body: r.body,
    created_at: Number(r.created_at),
  }));
}

export async function addComment(
  postId: number,
  userId: number,
  body: string,
): Promise<{ id: number } | null> {
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  const truncated = trimmed.slice(0, COMMENT_MAX);
  const r = await dbRun(
    "INSERT INTO comments (post_id, user_id, body, created_at) VALUES (?, ?, ?, ?)",
    [postId, userId, truncated, Date.now()],
  );
  return { id: r.lastInsertRowid };
}
