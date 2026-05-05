const BASE = "https://api.coingecko.com/api/v3";
const VS = "krw";

export type CoinSearchResult = {
  id: string;
  symbol: string;
  name: string;
  thumb?: string;
  market_cap_rank?: number | null;
};

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const q = query.trim();
  if (q.length === 0) return [];
  try {
    const r = await fetch(`${BASE}/search?query=${encodeURIComponent(q)}`, {
      next: { revalidate: 600 },
      headers: { accept: "application/json" },
    });
    if (!r.ok) return [];
    const data = (await r.json()) as { coins?: CoinSearchResult[] };
    return (data.coins ?? []).slice(0, 10).map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      thumb: c.thumb,
      market_cap_rank: c.market_cap_rank ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getPrices(coinIds: string[]): Promise<Record<string, number>> {
  if (coinIds.length === 0) return {};
  const unique = Array.from(new Set(coinIds.filter(Boolean)));
  try {
    const url = `${BASE}/simple/price?ids=${unique
      .map(encodeURIComponent)
      .join(",")}&vs_currencies=${VS}`;
    const r = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!r.ok) return {};
    const data = (await r.json()) as Record<string, Record<string, number>>;
    const out: Record<string, number> = {};
    for (const id of unique) {
      const v = data[id]?.[VS];
      if (typeof v === "number" && isFinite(v) && v > 0) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function getPrice(coinId: string): Promise<number | null> {
  const prices = await getPrices([coinId]);
  return prices[coinId] ?? null;
}
