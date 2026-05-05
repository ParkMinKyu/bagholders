import { NextResponse } from "next/server";
import {
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { dbGet, dbRun, type UserRow } from "@/lib/db";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const back = (error: string, kind: "error" | "ok" = "error") => {
    const url = new URL("/account/password", req.url);
    url.searchParams.set(kind, error);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (next.length < 6) return back("새 비밀번호는 6자 이상이어야 합니다.");
  if (next !== confirm) return back("새 비밀번호 확인이 일치하지 않습니다.");
  if (next === current) return back("기존과 다른 비밀번호를 사용해주세요.");

  const u = await dbGet<UserRow>("SELECT * FROM users WHERE id = ?", [me.id]);
  if (!u) return back("사용자가 없습니다.");
  const ok = await verifyPassword(current, u.password_hash);
  if (!ok) return back("현재 비밀번호가 일치하지 않습니다.");

  const hash = await hashPassword(next);
  await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [hash, me.id]);

  return back("비밀번호가 변경되었습니다.", "ok");
}
