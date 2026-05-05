import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addFavorite, removeFavorite } from "@/lib/favorites";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const tickerCode = String(form.get("ticker_code") ?? "").trim();
  const tickerSymbol = String(form.get("ticker_symbol") ?? "").trim();
  const tickerName = String(form.get("ticker_name") ?? "").trim();
  const action = String(form.get("action") ?? "favorite");

  // 즐겨찾기 후 머무는 페이지 (보통 /t/[code]).
  const fallback = new URL(req.url);
  fallback.pathname = tickerCode ? `/t/${encodeURIComponent(tickerCode)}` : "/";
  fallback.search = "";

  if (!tickerCode) return NextResponse.redirect(fallback, { status: 303 });

  if (action === "unfavorite") {
    await removeFavorite(me.id, tickerCode);
  } else {
    if (!tickerSymbol || !tickerName) {
      return NextResponse.redirect(fallback, { status: 303 });
    }
    await addFavorite(me.id, tickerCode, tickerSymbol, tickerName);
  }
  return NextResponse.redirect(fallback, { status: 303 });
}
