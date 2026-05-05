import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySession,
  getCurrentUser,
  getSessionToken,
  withdrawAccount,
} from "@/lib/auth";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const back = (error: string) => {
    const url = new URL("/account/withdraw", req.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (confirm !== "탈퇴합니다") {
    return back('확인 문구는 정확히 "탈퇴합니다"로 입력해주세요.');
  }
  if (!password) return back("비밀번호를 입력해주세요.");

  const r = await withdrawAccount(me.id, password);
  if (!r.ok) return back(r.error ?? "탈퇴 실패");

  // 세션 정리.
  const token = await getSessionToken();
  if (token) await destroySession(token);
  await clearSessionCookie();

  return NextResponse.redirect(new URL("/?goodbye=1", req.url), { status: 303 });
}
