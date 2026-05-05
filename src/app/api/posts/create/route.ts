import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbRun } from "@/lib/db";
import { POST_KINDS, calcPnlPct } from "@/lib/posts";
import { getPrice } from "@/lib/coingecko";

const VALID_KINDS = POST_KINDS.map((k) => k.key) as readonly string[];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  const tickerCode = String(form.get("ticker_code") ?? "").trim();
  const tickerSymbol = String(form.get("ticker_symbol") ?? "").trim().toUpperCase();
  const tickerName = String(form.get("ticker_name") ?? "").trim();
  const entryPrice = Number(form.get("entry_price"));
  const qtyRaw = form.get("quantity");
  const quantity = qtyRaw && String(qtyRaw).length > 0 ? Number(qtyRaw) : null;
  const comment = String(form.get("comment") ?? "").slice(0, 500);

  const back = (error: string) => {
    const url = new URL("/post/new", req.url);
    url.searchParams.set("error", error);
    if (kind) url.searchParams.set("kind", kind);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!VALID_KINDS.includes(kind)) return back("인증 종류를 선택해주세요.");
  if (!tickerCode || !tickerSymbol || !tickerName) {
    return back("코인을 검색해서 선택해주세요.");
  }
  if (!isFinite(entryPrice) || entryPrice <= 0) {
    return back(kind === "buy_high" ? "매수가는 0보다 커야 합니다." : "매도가는 0보다 커야 합니다.");
  }
  if (quantity !== null && (!isFinite(quantity) || quantity < 0)) {
    return back("수량이 올바르지 않습니다.");
  }

  const livePrice = await getPrice(tickerCode);
  if (!livePrice || livePrice <= 0) {
    return back("현재가를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.");
  }

  const pnl = calcPnlPct(entryPrice, livePrice);
  const now = Date.now();

  await dbRun(
    `INSERT INTO posts
       (user_id, kind, asset_type, ticker_code, ticker_symbol, ticker_name,
        entry_price, last_price, last_priced_at, quantity, comment, pnl_pct, created_at)
       VALUES (?, ?, 'crypto', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      kind,
      tickerCode,
      tickerSymbol,
      tickerName,
      entryPrice,
      livePrice,
      now,
      quantity,
      comment,
      pnl,
      now,
    ],
  );

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
