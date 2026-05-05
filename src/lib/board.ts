import { dbAll, dbBatch, dbGet, dbRun, type InValue } from "./db";
import {
  BOARD_BODY_MAX,
  BOARD_CATEGORY_KEYS,
  BOARD_COMMENT_MAX,
  BOARD_NICK_MAX,
  BOARD_TITLE_MAX,
} from "./board-config";

export type BoardListItem = {
  id: number;
  user_id: number | null;
  display_name: string;
  is_anon: boolean;
  category: string;
  title: string;
  has_image: boolean;
  upvotes: number;
  downvotes: number;
  score: number;
  comment_count: number;
  created_at: number;
};

export type BoardPostFull = {
  id: number;
  user_id: number | null;
  display_name: string;
  is_anon: boolean;
  category: string;
  title: string;
  body: string;
  image_url: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: number;
};

export type BoardCommentRow = {
  id: number;
  post_id: number;
  user_id: number | null;
  display_name: string;
  is_anon: boolean;
  body: string;
  created_at: number;
};

export type BoardSort = "latest" | "hot";
export type BoardHotPeriod = "day" | "week" | "month";

const PERIOD_MS: Record<BoardHotPeriod, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

function pickDisplayName(
  username: string | null,
  anon: string | null,
): { name: string; isAnon: boolean } {
  if (anon && anon.trim().length > 0) return { name: anon, isAnon: true };
  if (username) return { name: username, isAnon: false };
  return { name: "(탈퇴)", isAnon: true };
}

function sanitizeNick(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, BOARD_NICK_MAX);
}

export async function listBoardPosts(opts: {
  sort: BoardSort;
  category?: string;
  period?: BoardHotPeriod;
  limit?: number;
  before?: number; // 커서: latest용 (created_at 기준)
}): Promise<BoardListItem[]> {
  const limit = opts.limit ?? 30;
  const where: string[] = [];
  const args: InValue[] = [];

  if (opts.category && BOARD_CATEGORY_KEYS.includes(opts.category)) {
    where.push("p.category = ?");
    args.push(opts.category);
  }

  if (opts.sort === "hot") {
    const period = opts.period ?? "day";
    where.push("p.created_at >= ?");
    args.push(Date.now() - PERIOD_MS[period]);
  } else if (opts.before != null) {
    where.push("p.created_at < ?");
    args.push(opts.before);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const orderClause =
    opts.sort === "hot"
      ? "ORDER BY (p.upvotes - p.downvotes) DESC, p.upvotes DESC, p.created_at DESC"
      : "ORDER BY p.created_at DESC";

  args.push(limit);

  const rows = await dbAll<{
    id: number;
    user_id: number | null;
    username: string | null;
    anon_nickname: string | null;
    category: string;
    title: string;
    image_url: string | null;
    upvotes: number;
    downvotes: number;
    comment_count: number;
    created_at: number;
  }>(
    `SELECT
       p.id, p.user_id, u.username, p.anon_nickname,
       p.category, p.title, p.image_url, p.upvotes, p.downvotes, p.created_at,
       (SELECT COUNT(*) FROM board_comments c WHERE c.post_id = p.id) AS comment_count
     FROM board_posts p
     LEFT JOIN users u ON u.id = p.user_id
     ${whereClause}
     ${orderClause}
     LIMIT ?`,
    args,
  );

  return rows.map((r) => {
    const dn = pickDisplayName(r.username, r.anon_nickname);
    return {
      id: Number(r.id),
      user_id: r.user_id == null ? null : Number(r.user_id),
      display_name: dn.name,
      is_anon: dn.isAnon,
      category: r.category,
      title: r.title,
      has_image: !!r.image_url,
      upvotes: Number(r.upvotes),
      downvotes: Number(r.downvotes),
      score: Number(r.upvotes) - Number(r.downvotes),
      comment_count: Number(r.comment_count),
      created_at: Number(r.created_at),
    };
  });
}

export async function getBoardPost(id: number): Promise<BoardPostFull | null> {
  const row = await dbGet<{
    id: number;
    user_id: number | null;
    username: string | null;
    anon_nickname: string | null;
    category: string;
    title: string;
    body: string;
    image_url: string | null;
    upvotes: number;
    downvotes: number;
    created_at: number;
  }>(
    `SELECT p.id, p.user_id, u.username, p.anon_nickname,
            p.category, p.title, p.body, p.image_url,
            p.upvotes, p.downvotes, p.created_at
     FROM board_posts p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`,
    [id],
  );
  if (!row) return null;
  const dn = pickDisplayName(row.username, row.anon_nickname);
  return {
    id: Number(row.id),
    user_id: row.user_id == null ? null : Number(row.user_id),
    display_name: dn.name,
    is_anon: dn.isAnon,
    category: row.category,
    title: row.title,
    body: row.body,
    image_url: row.image_url,
    upvotes: Number(row.upvotes),
    downvotes: Number(row.downvotes),
    score: Number(row.upvotes) - Number(row.downvotes),
    created_at: Number(row.created_at),
  };
}

export async function createBoardPost(args: {
  userId: number;
  category: string;
  title: string;
  body: string;
  imageUrl: string | null;
  anonNickname: string | null;
}): Promise<{ id: number }> {
  const cat = BOARD_CATEGORY_KEYS.includes(args.category) ? args.category : "free";
  const title = args.title.trim().slice(0, BOARD_TITLE_MAX);
  const body = args.body.trim().slice(0, BOARD_BODY_MAX);
  const anon = sanitizeNick(args.anonNickname);
  const r = await dbRun(
    `INSERT INTO board_posts
       (user_id, anon_nickname, category, title, body, image_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [args.userId, anon, cat, title, body, args.imageUrl, Date.now()],
  );
  return { id: r.lastInsertRowid };
}

export type VoteKind = "up" | "down";

// 투표 토글: 같은 종류 다시 누르면 해제, 다른 종류면 전환.
// 반환값에 갱신된 카운트.
export async function voteBoardPost(
  postId: number,
  userId: number,
  kind: VoteKind,
): Promise<{ upvotes: number; downvotes: number; my: VoteKind | null } | null> {
  // 자기 글 투표 차단 (셀프 추천으로 점수 부풀리기 방어).
  const post = await dbGet<{ user_id: number | null }>(
    "SELECT user_id FROM board_posts WHERE id = ?",
    [postId],
  );
  if (!post) return null;
  if (post.user_id != null && Number(post.user_id) === userId) return null;

  const exists = await dbGet<{ kind: string }>(
    "SELECT kind FROM board_votes WHERE post_id = ? AND user_id = ?",
    [postId, userId],
  );

  let upDelta = 0;
  let downDelta = 0;
  let mine: VoteKind | null = null;

  if (!exists) {
    await dbRun(
      "INSERT INTO board_votes (post_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)",
      [postId, userId, kind, Date.now()],
    );
    if (kind === "up") upDelta = 1;
    else downDelta = 1;
    mine = kind;
  } else if (exists.kind === kind) {
    // 토글 해제
    await dbRun(
      "DELETE FROM board_votes WHERE post_id = ? AND user_id = ?",
      [postId, userId],
    );
    if (kind === "up") upDelta = -1;
    else downDelta = -1;
    mine = null;
  } else {
    // 전환
    await dbRun(
      "UPDATE board_votes SET kind = ?, created_at = ? WHERE post_id = ? AND user_id = ?",
      [kind, Date.now(), postId, userId],
    );
    if (kind === "up") {
      upDelta = 1;
      downDelta = -1;
    } else {
      upDelta = -1;
      downDelta = 1;
    }
    mine = kind;
  }

  await dbBatch([
    {
      sql: "UPDATE board_posts SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?",
      args: [upDelta, downDelta, postId],
    },
  ]);

  const row = await dbGet<{ upvotes: number; downvotes: number }>(
    "SELECT upvotes, downvotes FROM board_posts WHERE id = ?",
    [postId],
  );
  if (!row) return null;
  return {
    upvotes: Number(row.upvotes),
    downvotes: Number(row.downvotes),
    my: mine,
  };
}

export async function getMyBoardVote(
  postId: number,
  userId: number,
): Promise<VoteKind | null> {
  const r = await dbGet<{ kind: string }>(
    "SELECT kind FROM board_votes WHERE post_id = ? AND user_id = ?",
    [postId, userId],
  );
  if (!r) return null;
  return r.kind === "up" || r.kind === "down" ? (r.kind as VoteKind) : null;
}

export async function listBoardComments(
  postId: number,
  limit = 200,
): Promise<BoardCommentRow[]> {
  const rows = await dbAll<{
    id: number;
    post_id: number;
    user_id: number | null;
    username: string | null;
    anon_nickname: string | null;
    body: string;
    created_at: number;
  }>(
    `SELECT c.id, c.post_id, c.user_id, u.username, c.anon_nickname, c.body, c.created_at
     FROM board_comments c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC
     LIMIT ?`,
    [postId, limit],
  );
  return rows.map((r) => {
    const dn = pickDisplayName(r.username, r.anon_nickname);
    return {
      id: Number(r.id),
      post_id: Number(r.post_id),
      user_id: r.user_id == null ? null : Number(r.user_id),
      display_name: dn.name,
      is_anon: dn.isAnon,
      body: r.body,
      created_at: Number(r.created_at),
    };
  });
}

export async function addBoardComment(args: {
  postId: number;
  userId: number;
  body: string;
  anonNickname: string | null;
}): Promise<{ id: number } | null> {
  const trimmed = args.body.trim();
  if (trimmed.length === 0) return null;
  const truncated = trimmed.slice(0, BOARD_COMMENT_MAX);
  const anon = sanitizeNick(args.anonNickname);
  const r = await dbRun(
    `INSERT INTO board_comments (post_id, user_id, anon_nickname, body, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [args.postId, args.userId, anon, truncated, Date.now()],
  );
  return { id: r.lastInsertRowid };
}
