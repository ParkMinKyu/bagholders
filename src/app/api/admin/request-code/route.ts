import { NextResponse } from "next/server";
import { CODE_TTL_LABEL, adminEmailAllowed, createLoginCode } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import {
  checkLocked,
  getClientIp,
  recordFailure,
  type RateLimitOpts,
} from "@/lib/rate-limit";

const REQUEST_OPTS: RateLimitOpts = {
  max: 5,
  windowMs: 30 * 60 * 1000,
  lockMs: 30 * 60 * 1000,
};

export async function POST(req: Request) {
  const form = await req.formData();
  const emailRaw = String(form.get("email") ?? "").trim().toLowerCase();

  const back = (params: Record<string, string>) => {
    const url = new URL("/admin/login", req.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!emailRaw || !emailRaw.includes("@")) {
    return back({ error: "이메일을 정확히 입력해주세요." });
  }

  // Rate limit (IP+이메일 조합) — 코드 요청 도배·이메일 폭탄 방지.
  const ip = getClientIp(req);
  const key = `admin-req:${ip}:${emailRaw}`;
  const lockedFor = await checkLocked(key, REQUEST_OPTS);
  if (lockedFor !== null) {
    audit(req, {
      type: "login.locked",
      meta: { kind: "admin_request", email: emailRaw, lockedFor },
    });
    const min = Math.ceil(lockedFor / 60);
    return back({ error: `요청이 너무 많습니다. ${min}분 후 다시 시도해주세요.` });
  }
  await recordFailure(key, REQUEST_OPTS);

  // 화이트리스트 미포함이어도 같은 페이지(/admin/verify)로 리다이렉트해
  // 응답·동작 차이로 admin 이메일이 식별되지 않게 함 (열거 방지).
  // 실제 인증은 /api/admin/verify 에서 항상 "코드 불일치"로 실패.
  const verifyUrl = new URL("/admin/verify", req.url);
  verifyUrl.searchParams.set("email", emailRaw);

  if (!adminEmailAllowed(emailRaw)) {
    audit(req, {
      type: "login.fail",
      meta: { kind: "admin_request_unallowed", email: emailRaw },
    });
    return NextResponse.redirect(verifyUrl, { status: 303 });
  }

  const code = await createLoginCode(emailRaw);
  const result = await sendEmail({
    to: emailRaw,
    subject: "[bagholders.] 관리자 인증번호",
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color: #e63946;">bagholders. 관리자 인증</h2>
        <p>아래 코드를 ${CODE_TTL_LABEL} 안에 입력해주세요.</p>
        <p style="font-size: 32px; font-weight: 800; letter-spacing: 6px; background: #f5f5f5; padding: 16px; text-align: center; border-radius: 8px;">${code}</p>
        <p style="color: #888; font-size: 12px;">본인이 요청하지 않았다면 무시해주세요. 이 메일을 받지 않은 경우 누군가가 이 이메일로 관리자 로그인을 시도한 것입니다.</p>
      </div>
    `,
    text: `bagholders. 관리자 인증번호: ${code} (${CODE_TTL_LABEL} 유효)`,
  });

  audit(req, {
    type: "login.ok",
    meta: { kind: "admin_request", email: emailRaw, via: result.via },
  });

  return NextResponse.redirect(verifyUrl, { status: 303 });
}
