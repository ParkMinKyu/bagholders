import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { REACTIONS } from "@/lib/posts";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const postId = Number(form.get("post_id"));
  const kind = String(form.get("kind") ?? "");
  const referer = req.headers.get("referer") ?? new URL("/", req.url).toString();

  const valid = REACTIONS.some((r) => r.kind === kind);
  if (!valid || !Number.isFinite(postId)) {
    return NextResponse.redirect(referer, { status: 303 });
  }

  const exists = db
    .prepare("SELECT id FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ?")
    .get(postId, user.id, kind);

  if (exists) {
    db.prepare("DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ?").run(
      postId,
      user.id,
      kind,
    );
  } else {
    db.prepare(
      "INSERT INTO reactions (post_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)",
    ).run(postId, user.id, kind, Date.now());
  }

  return NextResponse.redirect(referer, { status: 303 });
}
