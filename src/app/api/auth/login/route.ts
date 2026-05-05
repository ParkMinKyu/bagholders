import { NextResponse } from "next/server";
import { db, type UserRow } from "@/lib/db";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const back = (error: string) => {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url, { status: 303 });
  };

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | UserRow
    | undefined;
  if (!user) return back("닉네임 또는 비밀번호가 틀렸습니다.");

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return back("닉네임 또는 비밀번호가 틀렸습니다.");

  const { token, expiresAt } = createSession(user.id);
  await setSessionCookie(token, expiresAt);
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
