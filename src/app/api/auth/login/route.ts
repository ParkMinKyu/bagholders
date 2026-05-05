import { NextResponse } from "next/server";
import { dbGet, type UserRow } from "@/lib/db";
import {
  PASSWORD_MAX,
  createSession,
  setSessionCookie,
  verifyPasswordTimingSafe,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  checkLocked,
  getClientIp,
  recordFailure,
  recordSuccess,
} from "@/lib/rate-limit";

export async function POST(req: Request) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "").slice(0, PASSWORD_MAX);

  const back = (error: string) => {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", error);
    return NextResponse.redirect(url, { status: 303 });
  };

  // Rate limit: IP + username(소문자) 조합 키.
  const ip = getClientIp(req);
  const key = `login:${ip}:${username.toLowerCase()}`;
  const lockedFor = await checkLocked(key);
  if (lockedFor !== null) {
    audit(req, { type: "login.locked", username, meta: { lockedFor } });
    const min = Math.ceil(lockedFor / 60);
    return back(`로그인 시도가 너무 많습니다. ${min}분 후 다시 시도해주세요.`);
  }

  // Case-insensitive username 조회 (대소문자 사칭 방어).
  const user = await dbGet<UserRow>(
    "SELECT * FROM users WHERE LOWER(username) = LOWER(?)",
    [username],
  );

  // 사용자 없어도 항상 bcrypt 1회 (timing attack 방어).
  const ok = await verifyPasswordTimingSafe(password, user?.password_hash);

  if (!user || !ok) {
    const r = await recordFailure(key);
    audit(req, {
      type: "login.fail",
      userId: user?.id ?? null,
      username,
      meta: { reason: !user ? "no_user" : "bad_password" },
    });
    if (r.lockedFor) {
      const min = Math.ceil(r.lockedFor / 60);
      return back(`로그인 시도 한도를 초과했습니다. ${min}분 후 다시 시도해주세요.`);
    }
    return back("닉네임 또는 비밀번호가 틀렸습니다.");
  }

  await recordSuccess(key);
  audit(req, { type: "login.ok", userId: user.id, username: user.username });

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
