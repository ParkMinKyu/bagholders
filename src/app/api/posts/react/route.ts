import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dbGet, dbRun } from "@/lib/db";
import { REACTIONS } from "@/lib/posts";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const postId = Number(form.get("post_id"));
  const kind = String(form.get("kind") ?? "");

  // referer를 redirect 대상으로 쓰되 same-origin만 허용 (open redirect 방어).
  const reqOrigin = new URL(req.url).origin;
  const refererRaw = req.headers.get("referer");
  let dest: string = new URL("/", req.url).toString();
  if (refererRaw) {
    try {
      const r = new URL(refererRaw);
      if (r.origin === reqOrigin) dest = r.toString();
    } catch {
      // 잘못된 URL 무시
    }
  }

  const valid = REACTIONS.some((r) => r.kind === kind);
  if (!valid || !Number.isFinite(postId)) {
    return NextResponse.redirect(dest, { status: 303 });
  }

  const exists = await dbGet<{ id: number }>(
    "SELECT id FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ?",
    [postId, user.id, kind],
  );

  if (exists) {
    await dbRun(
      "DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ?",
      [postId, user.id, kind],
    );
  } else {
    await dbRun(
      "INSERT INTO reactions (post_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)",
      [postId, user.id, kind, Date.now()],
    );
  }

  return NextResponse.redirect(dest, { status: 303 });
}
