import { NextResponse } from "next/server";
import { dbGet, dbRun } from "@/lib/db";
import {
  USERNAME_REGEX,
  createSession,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const back = (error: string) => {
    const url = new URL("/signup", req.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!USERNAME_REGEX.test(username)) {
    return back("닉네임은 한글/영문/숫자/_ 조합 2~16자만 가능합니다.");
  }
  if (password.length < 6) {
    return back("비밀번호는 6자 이상이어야 합니다.");
  }

  const existing = await dbGet<{ id: number }>("SELECT id FROM users WHERE username = ?", [
    username,
  ]);
  if (existing) {
    return back("이미 존재하는 닉네임입니다.");
  }

  const hash = await hashPassword(password);
  const info = await dbRun(
    "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
    [username, hash, Date.now()],
  );

  const userId = Number(info.lastInsertRowid);
  const { token, expiresAt } = await createSession(userId);
  await setSessionCookie(token, expiresAt);

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
