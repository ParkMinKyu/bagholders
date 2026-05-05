import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { dbRun } from "@/lib/db";
import { POST_KINDS, calcPnlPct } from "@/lib/posts";
import { getPrice } from "@/lib/upbit";

const VALID_KINDS = POST_KINDS.map((k) => k.key) as readonly string[];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

async function uploadImage(file: File, userId: number): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[posts/create] BLOB_READ_WRITE_TOKEN 없음 — 이미지 업로드 스킵");
    return null;
  }
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) return null;
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) return null;
  try {
    const ext = file.type.split("/")[1] ?? "bin";
    const key = `posts/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const blob = await put(key, file, {
      access: "public",
      contentType: file.type,
    });
    return blob.url;
  } catch (e) {
    console.warn("[posts/create] blob upload failed:", e);
    return null;
  }
}

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

  // 이미지 업로드는 가격 조회와 병렬 가능 — 둘 다 외부 IO.
  const imageFile = form.get("image");
  const imageUploadPromise =
    imageFile instanceof File && imageFile.size > 0
      ? uploadImage(imageFile, user.id)
      : Promise.resolve(null);

  const [livePrice, imageUrl] = await Promise.all([
    getPrice(tickerCode),
    imageUploadPromise,
  ]);
  const now = Date.now();

  // 시세를 못 가져와도 글은 작성 가능 — 다음 피드 로드 시 lazy refresh가 갱신.
  const lastPrice = livePrice && livePrice > 0 ? livePrice : entryPrice;
  const lastPricedAt = livePrice && livePrice > 0 ? now : 0;
  const pnl = calcPnlPct(entryPrice, lastPrice);

  await dbRun(
    `INSERT INTO posts
       (user_id, kind, asset_type, ticker_code, ticker_symbol, ticker_name,
        entry_price, last_price, last_priced_at, quantity, comment, pnl_pct, image_url, created_at)
       VALUES (?, ?, 'crypto', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      kind,
      tickerCode,
      tickerSymbol,
      tickerName,
      entryPrice,
      lastPrice,
      lastPricedAt,
      quantity,
      comment,
      pnl,
      imageUrl,
      now,
    ],
  );

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
