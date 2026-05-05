const VS = "krw";

const PUBLIC_BASE = "https://api.coingecko.com/api/v3";
const PRO_BASE = "https://pro-api.coingecko.com/api/v3";

const UA =
  "Mozilla/5.0 (compatible; bagholders/1.0; +https://bagholders.vercel.app)";

function apiKeyHeaders(): Record<string, string> {
  const proKey = process.env.COINGECKO_API_KEY;
  const demoKey = process.env.COINGECKO_DEMO_API_KEY;
  if (proKey) return { "x-cg-pro-api-key": proKey };
  if (demoKey) return { "x-cg-demo-api-key": demoKey };
  return {};
}

function baseUrl(): string {
  return process.env.COINGECKO_API_KEY ? PRO_BASE : PUBLIC_BASE;
}

type FetchOpts = { revalidateSec?: number; noStore?: boolean };

async function cgFetch(pathAndQuery: string, opts: FetchOpts = {}): Promise<Response> {
  const url = `${baseUrl()}${pathAndQuery}`;
  const init: RequestInit & { next?: { revalidate?: number } } = {
    headers: {
      accept: "application/json",
      "user-agent": UA,
      ...apiKeyHeaders(),
    },
  };
  if (opts.noStore) init.cache = "no-store";
  else if (opts.revalidateSec) init.next = { revalidate: opts.revalidateSec };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, init);
      if (r.ok) return r;
      lastErr = new Error(`HTTP ${r.status}`);
      console.warn(
        `[coingecko] ${url} failed: status=${r.status} attempt=${attempt + 1}`,
      );
      if (r.status >= 400 && r.status < 500 && r.status !== 429) {
        return r;
      }
      await new Promise((res) => setTimeout(res, 400 + attempt * 600));
    } catch (e) {
      lastErr = e;
      console.warn(`[coingecko] ${url} network error attempt=${attempt + 1}:`, e);
      await new Promise((res) => setTimeout(res, 400 + attempt * 600));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("coingecko fetch failed");
}

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
    const r = await cgFetch(`/search?query=${encodeURIComponent(q)}`, {
      revalidateSec: 600,
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
  } catch (e) {
    console.warn("[coingecko] searchCoins failed:", e);
    return [];
  }
}

const priceCache = new Map<string, { price: number; at: number }>();
const PRICE_TTL_MS = 60 * 1000;

export async function getPrices(coinIds: string[]): Promise<Record<string, number>> {
  if (coinIds.length === 0) return {};
  const unique = Array.from(new Set(coinIds.filter(Boolean)));
  const now = Date.now();

  const out: Record<string, number> = {};
  const missing: string[] = [];
  for (const id of unique) {
    const c = priceCache.get(id);
    if (c && now - c.at < PRICE_TTL_MS) out[id] = c.price;
    else missing.push(id);
  }
  if (missing.length === 0) return out;

  try {
    const r = await cgFetch(
      `/simple/price?ids=${missing
        .map(encodeURIComponent)
        .join(",")}&vs_currencies=${VS}`,
      { noStore: true },
    );
    if (!r.ok) {
      console.warn(`[coingecko] getPrices !ok: status=${r.status}`);
      return out;
    }
    const data = (await r.json()) as Record<string, Record<string, number>>;
    for (const id of missing) {
      const v = data[id]?.[VS];
      if (typeof v === "number" && isFinite(v) && v > 0) {
        out[id] = v;
        priceCache.set(id, { price: v, at: now });
      } else {
        console.warn(`[coingecko] getPrices missing or invalid for "${id}":`, data[id]);
      }
    }
    return out;
  } catch (e) {
    console.warn("[coingecko] getPrices failed:", e);
    return out;
  }
}

export async function getPrice(coinId: string): Promise<number | null> {
  const prices = await getPrices([coinId]);
  return prices[coinId] ?? null;
}
