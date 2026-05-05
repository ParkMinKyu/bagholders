import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { createBoardPost } from "@/lib/board";
import {
  BOARD_BODY_MAX,
  BOARD_CATEGORY_KEYS,
  BOARD_NICK_MAX,
  BOARD_TITLE_MAX,
} from "@/lib/board-config";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

async function uploadImage(file: File, userId: number): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) return null;
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) return null;
  try {
    const ext = file.type.split("/")[1] ?? "bin";
    const key = `board/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const blob = await put(key, file, {
      access: "public",
      contentType: file.type,
    });
    return blob.url;
  } catch (e) {
    console.warn("[board/create] blob upload failed:", e);
    return null;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  }

  const form = await req.formData();
  const category = String(form.get("category") ?? "free");
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const isAnon = String(form.get("anon") ?? "") === "on";
  const anonNicknameRaw = String(form.get("anon_nickname") ?? "").trim();
  const anonNickname = isAnon
    ? (anonNicknameRaw.length > 0 ? anonNicknameRaw : "ㅇㅇ").slice(0, BOARD_NICK_MAX)
    : null;

  const back = (error: string) => {
    const url = new URL("/b/new", req.url);
    url.searchParams.set("error", error);
    if (category) url.searchParams.set("category", category);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!BOARD_CATEGORY_KEYS.includes(category)) return back("말머리를 선택해주세요.");
  if (title.length === 0) return back("제목을 입력해주세요.");
  if (title.length > BOARD_TITLE_MAX) return back("제목이 너무 깁니다.");
  if (body.length === 0) return back("본문을 입력해주세요.");
  if (body.length > BOARD_BODY_MAX) return back("본문이 너무 깁니다.");

  const imageFile = form.get("image");
  const imageUrl =
    imageFile instanceof File && imageFile.size > 0
      ? await uploadImage(imageFile, user.id)
      : null;

  const r = await createBoardPost({
    userId: user.id,
    category,
    title,
    body,
    imageUrl,
    anonNickname,
  });

  return NextResponse.redirect(new URL(`/b/${r.id}`, req.url), { status: 303 });
}
