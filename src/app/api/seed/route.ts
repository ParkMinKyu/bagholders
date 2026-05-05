import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { InValue } from "@libsql/client";
import { dbAll, dbBatch } from "@/lib/db";
import { getPrices } from "@/lib/coingecko";

export const maxDuration = 60;

const TICKERS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", approx: 150_000_000 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", approx: 4_500_000 },
  { id: "ripple", symbol: "XRP", name: "XRP", approx: 3_000 },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", approx: 200 },
  { id: "solana", symbol: "SOL", name: "Solana", approx: 250_000 },
  { id: "cardano", symbol: "ADA", name: "Cardano", approx: 700 },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", approx: 25_000 },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", approx: 7_000 },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", approx: 30_000 },
  { id: "celo", symbol: "CELO", name: "Celo", approx: 500 },
  { id: "uniswap", symbol: "UNI", name: "Uniswap", approx: 12_000 },
  { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu", approx: 0.025 },
  { id: "pepe", symbol: "PEPE", name: "Pepe", approx: 0.012 },
  { id: "aptos", symbol: "APT", name: "Aptos", approx: 8_000 },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum", approx: 1_500 },
] as const;

const NICK_BASE = [
  "고점왕", "한강뷰", "통장박살", "상폐러", "물타기왕", "존버고수",
  "익절불가", "하락의신", "치킨러", "깡통계좌", "손절왕", "무지성매수",
  "고점매수왕", "행복회로", "신용대출러", "풀매수꾼", "풀매도꾼", "어림도없지",
  "내가사면", "내가팔면", "묻지마매수", "코인노예", "통곡의방", "월급증발",
  "비탄의손", "후회의화신", "이불킥장인", "생존자", "끝났음", "다음생엔",
  "삼가고인", "지하실로", "박살희생자", "마지막매수", "유튜브믿음",
  "트윗러", "공시믿음", "친구따라", "감으로매수", "직감의달인",
];
const NICK_SUFFIX = ["", "2", "3", "4", "5", "님", "씨", "_막내", "_사장", "_전무"];

const COMMENTS = [
  "내가 사면 떨어짐", "ㅋㅋ 또 물렸음", "이번엔 다를 줄 알았지",
  "삼가 고인의", "팔자마자 떡상 ㅋㅋㅋ", "10년 존버 시작",
  "내일은 오를거야", "어제 들어갈걸", "이거 진짜 마지막 매수",
  "ㄹㅇ 끝났음 안녕", "다음 생엔 잘하길", "바닥인 줄 알았는데 지하실",
  "친구 따라 매수했다 망함", "유튜브 보고 들어감", "공시 호재 보고 들어갔는데",
  "인플루언서 추천 ㄹㅇ", "이걸 왜 샀지", "무지성 매수",
  "트윗 보고 매수", "이걸로 비상금 다 날림", "월급의 종말",
  "마이너스 통장의 시작", "다음엔 안 들어갈게요", "정신차리자",
  "엄마한테 미안해", "롤백 좀", "2차 매수 들어감", "물타기 시동",
  "이거 진짜 바닥임", "ㅋㅋㅋㅋ 이게 나야",
  "", "", "", "", "",
];

const REACTION_KINDS = ["kkk", "rip", "wallet", "noway", "tear"] as const;

type Archetype =
  | "heavy_loser"
  | "mild_loser"
  | "lucky"
  | "sell_too_early"
  | "good_sell"
  | "mixed";

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function rndInt(min: number, max: number) {
  return Math.floor(rnd(min, max + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUsernames(count: number): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  for (const base of NICK_BASE) {
    for (const suf of NICK_SUFFIX) {
      const n = (base + suf).slice(0, 16);
      if (n.length >= 2 && !used.has(n)) {
        used.add(n);
        out.push(n);
        if (out.length >= count) return out;
      }
    }
  }
  return out;
}

function pickArchetype(): Archetype {
  const r = Math.random();
  if (r < 0.3) return "heavy_loser";
  if (r < 0.5) return "mild_loser";
  if (r < 0.65) return "lucky";
  if (r < 0.8) return "sell_too_early";
  if (r < 0.9) return "good_sell";
  return "mixed";
}

function archetypePost(arch: Archetype): {
  kind: "buy_high" | "sell_low";
  pnlTarget: number;
} {
  switch (arch) {
    case "heavy_loser":
      return { kind: "buy_high", pnlTarget: rnd(-90, -30) };
    case "mild_loser":
      return { kind: "buy_high", pnlTarget: rnd(-40, -3) };
    case "lucky":
      return { kind: "buy_high", pnlTarget: rnd(8, 80) };
    case "sell_too_early":
      return { kind: "sell_low", pnlTarget: rnd(20, 220) };
    case "good_sell":
      return { kind: "sell_low", pnlTarget: rnd(-50, -3) };
    case "mixed":
      return Math.random() < 0.5
        ? { kind: "buy_high", pnlTarget: rnd(-60, 30) }
        : { kind: "sell_low", pnlTarget: rnd(-30, 100) };
  }
}

function postCountForArchetype(a: Archetype): number {
  if (a === "heavy_loser") return rndInt(3, 12);
  if (a === "mild_loser") return rndInt(2, 8);
  if (a === "lucky") return rndInt(1, 5);
  if (a === "sell_too_early") return rndInt(2, 10);
  if (a === "good_sell") return rndInt(1, 5);
  return rndInt(2, 8);
}

function smartQuantity(entryPrice: number): number {
  const targetNotional = rnd(50_000, 50_000_000);
  return targetNotional / entryPrice;
}

async function runSeed(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userCount = Math.min(
    Math.max(Number(url.searchParams.get("users") ?? "100"), 1),
    200,
  );
  const noReset = url.searchParams.get("reset") === "0";
  const now = Date.now();

  if (!noReset) {
    await dbBatch([
      {
        sql: "DELETE FROM reactions WHERE user_id IN (SELECT id FROM users WHERE bio = ?)",
        args: ["[seed]"],
      },
      {
        sql: "DELETE FROM posts WHERE user_id IN (SELECT id FROM users WHERE bio = ?)",
        args: ["[seed]"],
      },
      {
        sql: "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE bio = ?)",
        args: ["[seed]"],
      },
      { sql: "DELETE FROM users WHERE bio = ?", args: ["[seed]"] },
    ]);
  }

  const livePrices = await getPrices(TICKERS.map((t) => t.id));
  const seedHash = await bcrypt.hash("seed_disabled", 6);
  const usernames = generateUsernames(userCount);

  // Insert users in batches
  const userInserts = usernames.map((name, i) => ({
    sql: "INSERT INTO users (username, password_hash, bio, created_at) VALUES (?, ?, '[seed]', ?)",
    args: [name, seedHash, now - (usernames.length - i) * 60_000],
  }));
  for (let i = 0; i < userInserts.length; i += 100) {
    await dbBatch(userInserts.slice(i, i + 100));
  }

  const userRows = await dbAll<{ id: number }>(
    "SELECT id FROM users WHERE bio = ? ORDER BY id ASC",
    ["[seed]"],
  );
  const userIds = userRows.map((r) => Number(r.id));

  // Generate posts
  type Stmt = { sql: string; args: InValue[] };
  const postInserts: Stmt[] = [];
  const postsPerUser: number[] = [];

  for (const uid of userIds) {
    const arch = pickArchetype();
    const n = postCountForArchetype(arch);
    postsPerUser.push(n);
    const userTickers: typeof TICKERS[number][] = [];

    for (let i = 0; i < n; i++) {
      let t: typeof TICKERS[number];
      if (userTickers.length > 0 && Math.random() < 0.45) {
        t = pick(userTickers);
      } else {
        t = pick(TICKERS);
        userTickers.push(t);
      }

      const { kind, pnlTarget } = archetypePost(arch);
      const lastPrice = livePrices[t.id] ?? t.approx;
      const entryPrice = lastPrice / (1 + pnlTarget / 100);
      const pnlPct = ((lastPrice - entryPrice) / entryPrice) * 100;
      const hasQty = Math.random() < 0.55;
      const quantity = hasQty ? smartQuantity(entryPrice) : null;
      const comment = pick(COMMENTS);
      const ageMs = Math.floor(rnd(0, 7 * 24 * 3600 * 1000));
      const createdAt = now - ageMs;

      postInserts.push({
        sql: `INSERT INTO posts
              (user_id, kind, asset_type, ticker_code, ticker_symbol, ticker_name,
               entry_price, last_price, last_priced_at, quantity, comment, pnl_pct, created_at)
              VALUES (?, ?, 'crypto', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          uid,
          kind,
          t.id,
          t.symbol,
          t.name,
          entryPrice,
          lastPrice,
          now,
          quantity,
          comment,
          pnlPct,
          createdAt,
        ],
      });
    }
  }

  for (let i = 0; i < postInserts.length; i += 100) {
    await dbBatch(postInserts.slice(i, i + 100));
  }

  // Reactions: pick from this seed batch only
  const newPostRows = await dbAll<{ id: number }>(
    `SELECT p.id FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE u.bio = ?
     ORDER BY p.id DESC
     LIMIT ?`,
    ["[seed]", postInserts.length],
  );
  const newPostIds = newPostRows.map((r) => Number(r.id));

  const reactionInserts: Stmt[] = [];
  const seen = new Set<string>();
  for (const pid of newPostIds) {
    const k = rndInt(0, 4);
    for (let i = 0; i < k; i++) {
      const reactor = pick(userIds);
      const kind = pick(REACTION_KINDS);
      const key = `${pid}-${reactor}-${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      reactionInserts.push({
        sql: "INSERT OR IGNORE INTO reactions (post_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)",
        args: [pid, reactor, kind, now - rndInt(0, 6 * 24 * 3600 * 1000)],
      });
    }
  }
  for (let i = 0; i < reactionInserts.length; i += 200) {
    await dbBatch(reactionInserts.slice(i, i + 200));
  }

  return NextResponse.json({
    ok: true,
    users: userIds.length,
    posts: postInserts.length,
    reactions: reactionInserts.length,
    livePricesFetched: Object.keys(livePrices).length,
    avgPostsPerUser:
      postsPerUser.length > 0
        ? postsPerUser.reduce((s, n) => s + n, 0) / postsPerUser.length
        : 0,
  });
}

export async function POST(req: Request) {
  try {
    return await runSeed(req);
  } catch (e) {
    console.error("[seed]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
