import { NextResponse } from "next/server";
import {
  PASSWORD_MAX,
  USERNAME_REGEX,
  getCurrentUser,
  verifyPassword,
} from "@/lib/auth";
import { dbGet, dbRun, type UserRow } from "@/lib/db";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const next = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "").slice(0, PASSWORD_MAX);

  const back = (error: string) => {
    const url = new URL("/account/username", req.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!USERNAME_REGEX.test(next)) {
    return back("닉네임은 한글/영문/숫자/_ 조합 2~16자만 가능합니다.");
  }
  if (next === me.username) return back("기존 닉네임과 같습니다.");

  const u = await dbGet<UserRow>("SELECT * FROM users WHERE id = ?", [me.id]);
  if (!u) return back("사용자가 없습니다.");
  const ok = await verifyPassword(password, u.password_hash);
  if (!ok) return back("비밀번호가 일치하지 않습니다.");

  // Case-insensitive 중복 검사 (본인 ID는 제외).
  const dup = await dbGet<{ id: number }>(
    "SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?",
    [next, me.id],
  );
  if (dup) return back("이미 존재하는 닉네임입니다.");

  await dbRun("UPDATE users SET username = ? WHERE id = ?", [next, me.id]);

  // 새 닉네임 프로필로 이동.
  return NextResponse.redirect(new URL(`/u/${next}`, req.url), { status: 303 });
}
