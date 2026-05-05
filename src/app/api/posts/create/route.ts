import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORIES, calcPnlPct } from "@/lib/posts";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const category = String(form.get("category") ?? "");
  const ticker = String(form.get("ticker") ?? "").trim();
  const buyPrice = Number(form.get("buy_price"));
  const currentPrice = Number(form.get("current_price"));
  const qtyRaw = form.get("quantity");
  const quantity = qtyRaw && String(qtyRaw).length > 0 ? Number(qtyRaw) : null;
  const comment = String(form.get("comment") ?? "").slice(0, 500);

  const back = (error: string) => {
    const url = new URL("/post/new", req.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return back("카테고리를 선택해주세요.");
  }
  if (!ticker || ticker.length > 40) return back("종목명을 입력해주세요.");
  if (!isFinite(buyPrice) || buyPrice <= 0) return back("매수가는 0보다 커야 합니다.");
  if (!isFinite(currentPrice) || currentPrice < 0) return back("현재가가 올바르지 않습니다.");
  if (quantity !== null && (!isFinite(quantity) || quantity < 0)) {
    return back("수량이 올바르지 않습니다.");
  }

  const pnl = calcPnlPct(buyPrice, currentPrice);

  db.prepare(
    `INSERT INTO posts
      (user_id, category, ticker, buy_price, current_price, quantity, comment, pnl_pct, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    category,
    ticker,
    buyPrice,
    currentPrice,
    quantity,
    comment,
    pnl,
    Date.now(),
  );

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
