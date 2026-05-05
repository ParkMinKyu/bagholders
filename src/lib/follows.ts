import { dbAll, dbGet, dbRun } from "./db";

export type FollowCounts = {
  followers: number;
  following: number;
};

export async function getFollowCounts(userId: number): Promise<FollowCounts> {
  const [a, b] = await Promise.all([
    dbGet<{ n: number }>(
      "SELECT COUNT(*) AS n FROM follows WHERE following_id = ?",
      [userId],
    ),
    dbGet<{ n: number }>(
      "SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?",
      [userId],
    ),
  ]);
  return {
    followers: Number(a?.n ?? 0),
    following: Number(b?.n ?? 0),
  };
}

export async function isFollowing(
  followerId: number,
  followingId: number,
): Promise<boolean> {
  if (followerId === followingId) return false;
  const row = await dbGet<{ n: number }>(
    "SELECT 1 AS n FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1",
    [followerId, followingId],
  );
  return !!row;
}

export async function follow(
  followerId: number,
  followingId: number,
): Promise<void> {
  if (followerId === followingId) return;
  await dbRun(
    "INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)",
    [followerId, followingId, Date.now()],
  );
}

export async function unfollow(
  followerId: number,
  followingId: number,
): Promise<void> {
  await dbRun(
    "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
    [followerId, followingId],
  );
}

export type FollowUser = {
  id: number;
  username: string;
  followed_at: number;
};

export async function listFollowers(userId: number, limit = 100): Promise<FollowUser[]> {
  const rows = await dbAll<{ id: number; username: string; created_at: number }>(
    `SELECT u.id, u.username, f.created_at
     FROM follows f
     JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = ?
     ORDER BY f.created_at DESC
     LIMIT ?`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    username: r.username,
    followed_at: Number(r.created_at),
  }));
}

export async function listFollowing(userId: number, limit = 100): Promise<FollowUser[]> {
  const rows = await dbAll<{ id: number; username: string; created_at: number }>(
    `SELECT u.id, u.username, f.created_at
     FROM follows f
     JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ?
     ORDER BY f.created_at DESC
     LIMIT ?`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    username: r.username,
    followed_at: Number(r.created_at),
  }));
}
