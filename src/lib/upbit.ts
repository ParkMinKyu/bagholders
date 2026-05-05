const BASE = "https://api.upbit.com/v1";

type UpbitMarket = {
  market: string; // "KRW-BTC"
  korean_name: string; // "비트코인"
  english_name: string; // "Bitcoin"
};

declare global {
  // eslint-disable-next-line no-var
  var __upbitMarkets: { rows: UpbitMarket[]; at: number } | undefined;
}

const MARKETS_TTL = 24 * 60 * 60 * 1000;

async function getMarkets(): Promise<UpbitMarket[]> {
  const cached = global.__upbitMarkets;
  if (cached && Date.now() - cached.at < MARKETS_TTL) return cached.rows;
  try {
    const r = await fetch(`${BASE}/market/all?is_details=false`, {
      next: { revalidate: 21600 },
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      console.warn(`[upbit] markets !ok: status=${r.status}`);
      return cached?.rows ?? [];
    }
    const all = (await r.json()) as UpbitMarket[];
    const krw = all.filter((m) => m.market.startsWith("KRW-"));
    global.__upbitMarkets = { rows: krw, at: Date.now() };
    return krw;
  } catch (e) {
    console.warn("[upbit] markets failed:", e);
    return cached?.rows ?? [];
  }
}

export type CoinSearchResult = {
  id: string; // upbit market like "KRW-BTC"
  symbol: string;
  name: string;
  thumb?: string;
  market_cap_rank?: number | null;
};

export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const markets = await getMarkets();
  const out: CoinSearchResult[] = [];
  for (const m of markets) {
    const symbol = m.market.replace("KRW-", "");
    const koLow = m.korean_name.toLowerCase();
    const enLow = m.english_name.toLowerCase();
    const sym = symbol.toLowerCase();
    if (koLow.includes(q) || enLow.includes(q) || sym.includes(q)) {
      out.push({
        id: m.market,
        symbol,
        name: m.korean_name || m.english_name || symbol,
        market_cap_rank: null,
      });
    }
  }
  // 정확 일치 우선, 그 다음 시작 일치, 나머지
  out.sort((a, b) => rank(a, q) - rank(b, q));
  return out.slice(0, 10);
}

function rank(c: CoinSearchResult, q: string): number {
  const sym = c.symbol.toLowerCase();
  const ko = c.name.toLowerCase();
  if (sym === q) return 0;
  if (sym.startsWith(q)) return 1;
  if (ko === q) return 2;
  if (ko.startsWith(q)) return 3;
  return 4;
}

const priceCache = new Map<string, { price: number; at: number }>();
const PRICE_TTL_MS = 60 * 1000;

export async function getPrices(
  markets: string[],
): Promise<Record<string, number>> {
  if (markets.length === 0) return {};
  const unique = Array.from(new Set(markets.filter(Boolean)));
  const now = Date.now();

  const out: Record<string, number> = {};
  const missing: string[] = [];
  for (const m of unique) {
    const c = priceCache.get(m);
    if (c && now - c.at < PRICE_TTL_MS) out[m] = c.price;
    else missing.push(m);
  }
  if (missing.length === 0) return out;

  try {
    const r = await fetch(
      `${BASE}/ticker?markets=${missing.join(",")}`,
      { cache: "no-store", headers: { accept: "application/json" } },
    );
    if (!r.ok) {
      console.warn(`[upbit] ticker !ok: status=${r.status}`);
      return out;
    }
    const data = (await r.json()) as { market: string; trade_price: number }[];
    for (const row of data) {
      if (typeof row.trade_price === "number" && row.trade_price > 0) {
        out[row.market] = row.trade_price;
        priceCache.set(row.market, { price: row.trade_price, at: now });
      }
    }
    return out;
  } catch (e) {
    console.warn("[upbit] getPrices failed:", e);
    return out;
  }
}

export async function getPrice(market: string): Promise<number | null> {
  const r = await getPrices([market]);
  return r[market] ?? null;
}
