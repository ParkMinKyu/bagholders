import { NextResponse } from "next/server";
import {
  adminEmailAllowed,
  createAdminSession,
  setAdminSessionCookie,
  verifyLoginCode,
} from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import {
  checkLocked,
  getClientIp,
  recordFailure,
  type RateLimitOpts,
} from "@/lib/rate-limit";

const VERIFY_OPTS: RateLimitOpts = {
  max: 10,
  windowMs: 30 * 60 * 1000,
  lockMs: 30 * 60 * 1000,
};

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const code = String(form.get("code") ?? "").trim();

  const back = (params: Record<string, string>) => {
    const url = new URL("/admin/verify", req.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!email || !code) {
    return back({ email, error: "이메일과 코드를 모두 입력해주세요." });
  }

  // Rate limit
  const ip = getClientIp(req);
  const key = `admin-verify:${ip}:${email}`;
  const lockedFor = await checkLocked(key, VERIFY_OPTS);
  if (lockedFor !== null) {
    audit(req, {
      type: "login.locked",
      meta: { kind: "admin_verify", email, lockedFor },
    });
    const min = Math.ceil(lockedFor / 60);
    return back({
      email,
      error: `시도가 너무 많습니다. ${min}분 후 다시 시도해주세요.`,
    });
  }

  // 화이트리스트에서 빠진 이메일은 생성 자체가 없었으니 무조건 wrong.
  if (!adminEmailAllowed(email)) {
    await recordFailure(key, VERIFY_OPTS);
    audit(req, {
      type: "login.fail",
      meta: { kind: "admin_verify_unallowed", email },
    });
    return back({ email, error: "코드가 일치하지 않습니다." });
  }

  const r = await verifyLoginCode(email, code);
  if (!r.ok) {
    await recordFailure(key, VERIFY_OPTS);
    audit(req, {
      type: "login.fail",
      meta: { kind: "admin_verify", email, reason: r.reason },
    });
    const msg =
      r.reason === "expired"
        ? "코드가 만료되었습니다. 다시 요청해주세요."
        : r.reason === "too_many"
          ? "시도 한도 초과. 코드를 다시 요청해주세요."
          : r.reason === "no_code"
            ? "발급된 코드가 없습니다. 먼저 코드를 요청해주세요."
            : "코드가 일치하지 않습니다.";
    return back({ email, error: msg });
  }

  const { token, expiresAt } = await createAdminSession(email);
  await setAdminSessionCookie(token, expiresAt);
  audit(req, { type: "login.ok", meta: { kind: "admin_verify", email } });

  return NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
}
