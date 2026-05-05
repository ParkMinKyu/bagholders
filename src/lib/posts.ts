import { db, type PostRow, type UserRow } from "./db";

export const CATEGORIES = ["매수인증", "존버인증", "손절인증", "익절인증"] as const;
export type Category = (typeof CATEGORIES)[number];

export const REACTIONS = [
  { kind: "kkk", emoji: "🤣", label: "ㅋㅋㅋㅋ" },
  { kind: "rip", emoji: "🪦", label: "삼가 고인의 명복을" },
  { kind: "wallet", emoji: "💸", label: "통장은 안녕하신가요" },
  { kind: "noway", emoji: "🙅", label: "어림도 없지" },
  { kind: "tear", emoji: "😭", label: "눈물의 손절" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];

export function calcPnlPct(buy: number, current: number): number {
  if (!isFinite(buy) || buy <= 0) return 0;
  return ((current - buy) / buy) * 100;
}

export type FeedPost = PostRow & {
  username: string;
  reaction_counts: Record<string, number>;
  my_reactions: string[];
};

export function listFeed(viewerId: number | null, limit = 50, offset = 0): FeedPost[] {
  const posts = db
    .prepare(
      `SELECT p.*, u.username FROM posts p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as (PostRow & { username: string })[];
  return decoratePosts(posts, viewerId);
}

export function listUserPosts(userId: number, viewerId: number | null): FeedPost[] {
  const posts = db
    .prepare(
      `SELECT p.*, u.username FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
    )
    .all(userId) as (PostRow & { username: string })[];
  return decoratePosts(posts, viewerId);
}

function decoratePosts(
  posts: (PostRow & { username: string })[],
  viewerId: number | null,
): FeedPost[] {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");

  const counts = db
    .prepare(
      `SELECT post_id, kind, COUNT(*) AS n FROM reactions
       WHERE post_id IN (${placeholders})
       GROUP BY post_id, kind`,
    )
    .all(...ids) as { post_id: number; kind: string; n: number }[];

  const myReacts = viewerId
    ? (db
        .prepare(
          `SELECT post_id, kind FROM reactions
           WHERE post_id IN (${placeholders}) AND user_id = ?`,
        )
        .all(...ids, viewerId) as { post_id: number; kind: string }[])
    : [];

  const countMap = new Map<number, Record<string, number>>();
  for (const r of counts) {
    if (!countMap.has(r.post_id)) countMap.set(r.post_id, {});
    countMap.get(r.post_id)![r.kind] = r.n;
  }
  const myMap = new Map<number, string[]>();
  for (const r of myReacts) {
    if (!myMap.has(r.post_id)) myMap.set(r.post_id, []);
    myMap.get(r.post_id)!.push(r.kind);
  }

  return posts.map((p) => ({
    ...p,
    reaction_counts: countMap.get(p.id) ?? {},
    my_reactions: myMap.get(p.id) ?? [],
  }));
}

export type RankingRow = {
  user_id: number;
  username: string;
  post_count: number;
  avg_loss: number;
  worst_loss: number;
};

export function getRanking(limit = 50): RankingRow[] {
  return db
    .prepare(
      `SELECT u.id AS user_id, u.username,
              COUNT(p.id) AS post_count,
              AVG(p.pnl_pct) AS avg_loss,
              MIN(p.pnl_pct) AS worst_loss
       FROM users u
       JOIN posts p ON p.user_id = u.id
       GROUP BY u.id
       HAVING COUNT(p.id) >= 1
       ORDER BY avg_loss ASC
       LIMIT ?`,
    )
    .all(limit) as RankingRow[];
}

export function getUserByUsername(username: string): UserRow | null {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | UserRow
    | undefined;
  return row ?? null;
}
