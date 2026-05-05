// 구조화된 보안 감사 로그. Vercel Functions 로그에 JSON으로 남겨
// 검색·필터 가능하게. 운영자가 의심 활동을 추적할 때 사용.

export type AuditType =
  | "login.ok"
  | "login.fail"
  | "login.locked"
  | "signup.ok"
  | "signup.fail"
  | "password.change"
  | "username.change"
  | "withdraw.ok"
  | "withdraw.fail"
  | "report.create"
  | "report.rate_limited";

export type AuditEvent = {
  type: AuditType;
  userId?: number | null;
  username?: string | null;
  ip?: string | null;
  ua?: string | null;
  meta?: Record<string, unknown>;
};

export function audit(req: Request | null, event: AuditEvent): void {
  const ua = req?.headers.get("user-agent") ?? null;
  const xff = req?.headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0]?.trim() : (req?.headers.get("x-real-ip") ?? null);
  const payload = {
    audit: true,
    ts: new Date().toISOString(),
    type: event.type,
    user_id: event.userId ?? null,
    username: event.username ?? null,
    ip: event.ip ?? ip ?? null,
    ua: event.ua ?? ua ?? null,
    ...(event.meta ?? {}),
  };
  // Vercel Logs는 console.log 한 줄 = 한 이벤트로 캡처.
  console.log("[audit]", JSON.stringify(payload));
}
