import { dbAll, dbBatch, dbGet, type PostRow, type UserRow } from "./db";
import { getPrices } from "./upbit";

export {
  POST_KINDS,
  REACTIONS,
  PRICE_STALE_MS,
  calcPnlPct,
  badnessScore,
} from "./post-kinds";
export type { PostKind, ReactionKind } from "./post-kinds";

import { PRICE_STALE_MS, badnessScore, calcPnlPct, type PostKind } from "./post-kinds";

export type FeedPost = PostRow & {
  username: string;
  reaction_counts: Record<string, number>;
  my_reactions: string[];
  badness: number;
};

export type TickerStat = {
  ticker_code: string;
  ticker_symbol: string;
  ticker_name: string;
  last_price: number;
  last_priced_at: number;
  buy: TickerSideStat;
  sell: TickerSideStat;
  total_count: number;
  net_pnl_krw: number;
  has_any_qty: boolean;
};

export type TickerSideStat = {
  count: number;
  avg_entry: number;
  total_qty: number;
  avg_display_pnl: number;
  pnl_krw: number;
  has_qty: boolean;
};

export function aggregateByTicker(posts: FeedPost[]): TickerStat[] {
  const groups = new Map<string, FeedPost[]>();
  for (const p of posts) {
    const arr = groups.get(p.ticker_code);
    if (arr) arr.push(p);
    else groups.set(p.ticker_code, [p]);
  }

  const rollup = (group: FeedPost[], isBuy: boolean): TickerSideStat => {
    if (group.length === 0) {
      return {
        count: 0,
        avg_entry: 0,
        total_qty: 0,
        avg_display_pnl: 0,
        pnl_krw: 0,
        has_qty: false,
      };
    }
    let entrySum = 0;
    let qtySum = 0;
    let pnlSum = 0;
    let pnlKrw = 0;
    let hasQty = false;
    for (const p of group) {
      const entry = Number(p.entry_price);
      const last = Number(p.last_price);
      const qtyRaw = p.quantity == null ? null : Number(p.quantity);
      const rawPnl = Number(p.pnl_pct);
      entrySum += entry;
      pnlSum += isBuy ? rawPnl : -rawPnl;
      if (qtyRaw != null && qtyRaw > 0 && isFinite(qtyRaw)) {
        hasQty = true;
        qtySum += qtyRaw;
        pnlKrw += isBuy
          ? (last - entry) * qtyRaw
          : (entry - last) * qtyRaw;
      }
    }
    return {
      count: group.length,
      avg_entry: entrySum / group.length,
      total_qty: qtySum,
      avg_display_pnl: pnlSum / group.length,
      pnl_krw: pnlKrw,
      has_qty: hasQty,
    };
  };

  const stats: TickerStat[] = [];
  for (const [code, ps] of groups) {
    const freshest = ps.reduce((acc, p) =>
      Number(p.last_priced_at) > Number(acc.last_priced_at) ? p : acc,
    );
    const buys = ps.filter((p) => p.kind === "buy_high");
    const sells = ps.filter((p) => p.kind === "sell_low");
    const buy = rollup(buys, true);
    const sell = rollup(sells, false);
    stats.push({
      ticker_code: code,
      ticker_symbol: ps[0].ticker_symbol,
      ticker_name: ps[0].ticker_name,
      last_price: Number(freshest.last_price),
      last_priced_at: Number(freshest.last_priced_at),
      buy,
      sell,
      total_count: ps.length,
      net_pnl_krw: buy.pnl_krw + sell.pnl_krw,
      has_any_qty: buy.has_qty || sell.has_qty,
    });
  }
  return stats.sort((a, b) => b.total_count - a.total_count);
}

async function refreshStale(rows: PostRow[]): Promise<PostRow[]> {
  const now = Date.now();
  const stale = rows.filter((r) => now - Number(r.last_priced_at) > PRICE_STALE_MS);
  if (stale.length === 0) return rows;

  const tickers = Array.from(new Set(stale.map((r) => r.ticker_code)));
  const prices = await getPrices(tickers);
  if (Object.keys(prices).length === 0) return rows;

  // 티커별 UPDATE를 단일 batch로 묶어 1 round-trip으로 압축.
  await dbBatch(
    Object.entries(prices).map(([ticker, price]) => ({
      sql: `UPDATE posts SET
              last_price = ?,
              last_priced_at = ?,
              pnl_pct = CASE WHEN entry_price > 0
                THEN ((? - entry_price) / entry_price) * 100
                ELSE 0
              END
            WHERE ticker_code = ? AND last_priced_at < ?`,
      args: [price, now, price, ticker, now - 1000],
    })),
  ).catch((e) => {
    console.warn("[refreshStale] batch update failed:", e);
  });

  const fresh = new Map<number, PostRow>();
  for (const r of stale) {
    const newPrice = prices[r.ticker_code];
    if (!newPrice || newPrice <= 0) continue;
    fresh.set(r.id, {
      ...r,
      last_price: newPrice,
      last_priced_at: now,
      pnl_pct: calcPnlPct(Number(r.entry_price), newPrice),
    });
  }

  return rows.map((r) => fresh.get(r.id) ?? r);
}

async function decoratePosts(
  posts: (PostRow & { username: string })[],
  viewerId: number | null,
): Promise<FeedPost[]> {
  if (posts.length === 0) return [];

  const refreshed = (await refreshStale(posts)) as (PostRow & { username: string })[];

  const ids = refreshed.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");

  // 두 쿼리 병렬 실행 (libsql 클라이언트는 동시 execute 지원).
  const [counts, myReacts] = await Promise.all([
    dbAll<{ post_id: number; kind: string; n: number }>(
      `SELECT post_id, kind, COUNT(*) AS n FROM reactions
       WHERE post_id IN (${placeholders})
       GROUP BY post_id, kind`,
      ids,
    ),
    viewerId
      ? dbAll<{ post_id: number; kind: string }>(
          `SELECT post_id, kind FROM reactions
           WHERE post_id IN (${placeholders}) AND user_id = ?`,
          [...ids, viewerId],
        )
      : Promise.resolve([] as { post_id: number; kind: string }[]),
  ]);

  const countMap = new Map<number, Record<string, number>>();
  for (const r of counts) {
    if (!countMap.has(r.post_id)) countMap.set(r.post_id, {});
    countMap.get(r.post_id)![r.kind] = Number(r.n);
  }
  const myMap = new Map<number, string[]>();
  for (const r of myReacts) {
    if (!myMap.has(r.post_id)) myMap.set(r.post_id, []);
    myMap.get(r.post_id)!.push(r.kind);
  }

  return refreshed.map((p) => ({
    ...p,
    reaction_counts: countMap.get(p.id) ?? {},
    my_reactions: myMap.get(p.id) ?? [],
    badness: badnessScore(p.kind, Number(p.pnl_pct)),
  }));
}

export async function listFeed(
  viewerId: number | null,
  limit = 50,
  offset = 0,
): Promise<FeedPost[]> {
  const posts = await dbAll<PostRow & { username: string }>(
    `SELECT p.*, u.username FROM posts p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return decoratePosts(posts, viewerId);
}

export async function listUserPosts(
  userId: number,
  viewerId: number | null,
): Promise<FeedPost[]> {
  const posts = await dbAll<PostRow & { username: string }>(
    `SELECT p.*, u.username FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return decoratePosts(posts, viewerId);
}

export async function listTickerPosts(
  tickerCode: string,
  viewerId: number | null,
  limit = 100,
): Promise<FeedPost[]> {
  const posts = await dbAll<PostRow & { username: string }>(
    `SELECT p.*, u.username FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.ticker_code = ?
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [tickerCode, limit],
  );
  return decoratePosts(posts, viewerId);
}

export type RankingRow = {
  user_id: number;
  username: string;
  post_count: number;
  badness_avg: number;
  badness_worst: number;
};

export type CoinRankingRow = {
  ticker_code: string;
  ticker_symbol: string;
  ticker_name: string;
  post_count: number;
  buy_count: number;
  sell_count: number;
  badness_avg: number;
  badness_worst: number;
  last_price: number;
  last_priced_at: number;
};

export async function refreshAllStaleTickers(): Promise<void> {
  const now = Date.now();
  const stale = await dbAll<{ ticker_code: string }>(
    `SELECT DISTINCT ticker_code FROM posts WHERE last_priced_at < ?`,
    [now - PRICE_STALE_MS],
  );
  if (stale.length === 0) return;
  const tickers = stale.map((r) => r.ticker_code);
  const prices = await getPrices(tickers);
  if (Object.keys(prices).length === 0) return;
  await dbBatch(
    Object.entries(prices).map(([ticker, price]) => ({
      sql: `UPDATE posts SET
              last_price = ?,
              last_priced_at = ?,
              pnl_pct = CASE WHEN entry_price > 0
                THEN ((? - entry_price) / entry_price) * 100
                ELSE 0
              END
            WHERE ticker_code = ? AND last_priced_at < ?`,
      args: [price, now, price, ticker, now - 1000],
    })),
  ).catch((e) => {
    console.warn("[refreshAllStaleTickers] batch update failed:", e);
  });
}

export async function getCoinRanking(limit = 20): Promise<CoinRankingRow[]> {
  // refreshAllStaleTickers는 호출자가 책임 (랭킹 페이지에서 1회 실행 후 병렬 쿼리).
  const rows = await dbAll<{
    ticker_code: string;
    ticker_symbol: string;
    ticker_name: string;
    post_count: number;
    buy_count: number;
    sell_count: number;
    badness_avg: number;
    badness_worst: number;
    last_price: number;
    last_priced_at: number;
  }>(
    `SELECT
       ticker_code,
       ticker_symbol,
       ticker_name,
       COUNT(*) AS post_count,
       SUM(CASE WHEN kind = 'buy_high' THEN 1 ELSE 0 END) AS buy_count,
       SUM(CASE WHEN kind = 'sell_low' THEN 1 ELSE 0 END) AS sell_count,
       AVG(CASE WHEN kind = 'buy_high' THEN -pnl_pct ELSE pnl_pct END) AS badness_avg,
       MAX(CASE WHEN kind = 'buy_high' THEN -pnl_pct ELSE pnl_pct END) AS badness_worst,
       MAX(last_price) AS last_price,
       MAX(last_priced_at) AS last_priced_at
     FROM posts
     GROUP BY ticker_code, ticker_symbol, ticker_name
     ORDER BY post_count DESC, badness_avg DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    ticker_code: r.ticker_code,
    ticker_symbol: r.ticker_symbol,
    ticker_name: r.ticker_name,
    post_count: Number(r.post_count),
    buy_count: Number(r.buy_count),
    sell_count: Number(r.sell_count),
    badness_avg: Number(r.badness_avg),
    badness_worst: Number(r.badness_worst),
    last_price: Number(r.last_price),
    last_priced_at: Number(r.last_priced_at),
  }));
}

export async function getRanking(viewerId: number | null, limit = 50): Promise<RankingRow[]> {
  // refreshAllStaleTickers는 호출자가 책임 (랭킹 페이지에서 1회 실행 후 병렬 쿼리).
  const rows = await dbAll<{
    user_id: number;
    username: string;
    post_count: number;
    badness_avg: number;
    badness_worst: number;
  }>(
    `SELECT
       u.id AS user_id,
       u.username AS username,
       COUNT(p.id) AS post_count,
       AVG(CASE WHEN p.kind = 'buy_high' THEN -p.pnl_pct ELSE p.pnl_pct END) AS badness_avg,
       MAX(CASE WHEN p.kind = 'buy_high' THEN -p.pnl_pct ELSE p.pnl_pct END) AS badness_worst
     FROM users u
     JOIN posts p ON p.user_id = u.id
     GROUP BY u.id, u.username
     HAVING COUNT(p.id) >= 1
     ORDER BY badness_avg DESC
     LIMIT ?`,
    [limit],
  );
  void viewerId;
  return rows.map((r) => ({
    user_id: Number(r.user_id),
    username: r.username,
    post_count: Number(r.post_count),
    badness_avg: Number(r.badness_avg),
    badness_worst: Number(r.badness_worst),
  }));
}

export async function getUserByUsername(username: string): Promise<UserRow | null> {
  const row = await dbGet<UserRow>("SELECT * FROM users WHERE username = ?", [username]);
  return row ?? null;
}

export type UserRankInfo = {
  rank: number; // 1부터 시작
  total: number; // 인증 1건 이상 가진 사용자 수
  badness_avg: number;
};

export async function getUserRank(userId: number): Promise<UserRankInfo | null> {
  // CTE로 모든 사용자의 평균 망함도를 계산한 뒤 본인보다 높은 사람 수 + 1 = 랭크.
  // 인증이 없으면 score CTE에 안 들어가므로 결과 null.
  const row = await dbGet<{
    rank: number;
    total: number;
    badness: number | null;
  }>(
    `WITH scores AS (
       SELECT
         user_id,
         AVG(CASE WHEN kind='buy_high' THEN -pnl_pct ELSE pnl_pct END) AS badness
       FROM posts
       GROUP BY user_id
     )
     SELECT
       (SELECT COUNT(*) FROM scores WHERE badness > (SELECT badness FROM scores WHERE user_id = ?)) + 1 AS rank,
       (SELECT COUNT(*) FROM scores) AS total,
       (SELECT badness FROM scores WHERE user_id = ?) AS badness`,
    [userId, userId],
  );
  if (!row || row.badness == null) return null;
  return {
    rank: Number(row.rank),
    total: Number(row.total),
    badness_avg: Number(row.badness),
  };
}

export type UserSearchHit = {
  id: number;
  username: string;
  post_count: number;
  badness_avg: number;
};

export type TickerSearchHit = {
  ticker_code: string;
  ticker_symbol: string;
  ticker_name: string;
  post_count: number;
  buy_count: number;
  sell_count: number;
  last_price: number;
  last_priced_at: number;
};

// SQLite/libSQL: LIKE escape를 위해 백슬래시 사용 (% 와 _ 만).
function likePattern(q: string): string {
  const escaped = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${escaped}%`;
}

export async function searchUsers(q: string, limit = 10): Promise<UserSearchHit[]> {
  const trimmed = q.trim();
  if (trimmed.length === 0) return [];
  const pat = likePattern(trimmed);
  const rows = await dbAll<{
    id: number;
    username: string;
    post_count: number;
    badness_avg: number | null;
  }>(
    `SELECT
       u.id AS id,
       u.username AS username,
       COUNT(p.id) AS post_count,
       AVG(CASE WHEN p.kind = 'buy_high' THEN -p.pnl_pct ELSE p.pnl_pct END) AS badness_avg
     FROM users u
     LEFT JOIN posts p ON p.user_id = u.id
     WHERE u.username LIKE ? ESCAPE '\\'
     GROUP BY u.id, u.username
     ORDER BY
       CASE WHEN LOWER(u.username) = LOWER(?) THEN 0
            WHEN LOWER(u.username) LIKE LOWER(?) THEN 1
            ELSE 2 END,
       post_count DESC,
       u.id ASC
     LIMIT ?`,
    [pat, trimmed, `${trimmed.toLowerCase()}%`, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    username: r.username,
    post_count: Number(r.post_count),
    badness_avg: r.badness_avg == null ? 0 : Number(r.badness_avg),
  }));
}

export async function searchTickers(q: string, limit = 10): Promise<TickerSearchHit[]> {
  const trimmed = q.trim();
  if (trimmed.length === 0) return [];
  const pat = likePattern(trimmed);
  const rows = await dbAll<{
    ticker_code: string;
    ticker_symbol: string;
    ticker_name: string;
    post_count: number;
    buy_count: number;
    sell_count: number;
    last_price: number;
    last_priced_at: number;
  }>(
    `SELECT
       ticker_code,
       ticker_symbol,
       ticker_name,
       COUNT(*) AS post_count,
       SUM(CASE WHEN kind = 'buy_high' THEN 1 ELSE 0 END) AS buy_count,
       SUM(CASE WHEN kind = 'sell_low' THEN 1 ELSE 0 END) AS sell_count,
       MAX(last_price) AS last_price,
       MAX(last_priced_at) AS last_priced_at
     FROM posts
     WHERE ticker_symbol LIKE ? ESCAPE '\\'
        OR ticker_name LIKE ? ESCAPE '\\'
        OR ticker_code LIKE ? ESCAPE '\\'
     GROUP BY ticker_code, ticker_symbol, ticker_name
     ORDER BY
       CASE WHEN LOWER(ticker_symbol) = LOWER(?) THEN 0
            WHEN LOWER(ticker_symbol) LIKE LOWER(?) THEN 1
            ELSE 2 END,
       post_count DESC
     LIMIT ?`,
    [pat, pat, pat, trimmed, `${trimmed.toLowerCase()}%`, limit],
  );
  return rows.map((r) => ({
    ticker_code: r.ticker_code,
    ticker_symbol: r.ticker_symbol,
    ticker_name: r.ticker_name,
    post_count: Number(r.post_count),
    buy_count: Number(r.buy_count),
    sell_count: Number(r.sell_count),
    last_price: Number(r.last_price),
    last_priced_at: Number(r.last_priced_at),
  }));
}
