import { dbAll, dbGet, dbRun } from "./db";

export type FavoriteCoin = {
  ticker_code: string;
  ticker_symbol: string;
  ticker_name: string;
  created_at: number;
};

export async function getFavoriteCount(userId: number): Promise<number> {
  const row = await dbGet<{ n: number }>(
    "SELECT COUNT(*) AS n FROM coin_favorites WHERE user_id = ?",
    [userId],
  );
  return Number(row?.n ?? 0);
}

export async function isFavorited(
  userId: number,
  tickerCode: string,
): Promise<boolean> {
  const row = await dbGet<{ n: number }>(
    "SELECT 1 AS n FROM coin_favorites WHERE user_id = ? AND ticker_code = ? LIMIT 1",
    [userId, tickerCode],
  );
  return !!row;
}

export async function addFavorite(
  userId: number,
  tickerCode: string,
  tickerSymbol: string,
  tickerName: string,
): Promise<void> {
  await dbRun(
    `INSERT OR IGNORE INTO coin_favorites
       (user_id, ticker_code, ticker_symbol, ticker_name, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, tickerCode, tickerSymbol, tickerName, Date.now()],
  );
}

export async function removeFavorite(
  userId: number,
  tickerCode: string,
): Promise<void> {
  await dbRun(
    "DELETE FROM coin_favorites WHERE user_id = ? AND ticker_code = ?",
    [userId, tickerCode],
  );
}

export async function listFavorites(
  userId: number,
  limit = 200,
): Promise<FavoriteCoin[]> {
  const rows = await dbAll<{
    ticker_code: string;
    ticker_symbol: string;
    ticker_name: string;
    created_at: number;
  }>(
    `SELECT ticker_code, ticker_symbol, ticker_name, created_at
     FROM coin_favorites
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, limit],
  );
  return rows.map((r) => ({
    ticker_code: r.ticker_code,
    ticker_symbol: r.ticker_symbol,
    ticker_name: r.ticker_name,
    created_at: Number(r.created_at),
  }));
}
