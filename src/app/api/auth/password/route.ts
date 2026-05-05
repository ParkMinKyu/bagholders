import { NextResponse } from "next/server";
import {
  PASSWORD_MAX,
  getCurrentUser,
  getSessionToken,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { dbGet, dbRun, type UserRow } from "@/lib/db";

const PASSWORD_MIN = 8;

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const current = String(form.get("current") ?? "").slice(0, PASSWORD_MAX);
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const back = (error: string, kind: "error" | "ok" = "error") => {
    const url = new URL("/account/password", req.url);
    url.searchParams.set(kind, error);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (next.length < PASSWORD_MIN) return back(`새 비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`);
  if (next.length > PASSWORD_MAX) return back(`새 비밀번호는 ${PASSWORD_MAX}자 이하여야 합니다.`);
  if (next !== confirm) return back("새 비밀번호 확인이 일치하지 않습니다.");
  if (next === current) return back("기존과 다른 비밀번호를 사용해주세요.");

  const u = await dbGet<UserRow>("SELECT * FROM users WHERE id = ?", [me.id]);
  if (!u) return back("사용자가 없습니다.");
  const ok = await verifyPassword(current, u.password_hash);
  if (!ok) return back("현재 비밀번호가 일치하지 않습니다.");

  const hash = await hashPassword(next);
  // 비밀번호 교체 + 현재 세션 외 모든 세션 무효화 (탈취된 세션 차단).
  const myToken = await getSessionToken();
  await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", [hash, me.id]);
  await dbRun(
    "DELETE FROM sessions WHERE user_id = ? AND token != ?",
    [me.id, myToken ?? ""],
  );

  return back("비밀번호가 변경되었습니다. 다른 기기 세션은 모두 종료됐습니다.", "ok");
}
