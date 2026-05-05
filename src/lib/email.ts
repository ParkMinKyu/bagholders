// 이메일 발송 — Resend HTTP API 사용 (npm 의존성 없이).
// RESEND_API_KEY 가 없으면 console에 출력 (개발/부트스트랩용).

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(
  args: SendEmailArgs,
): Promise<{ ok: boolean; via: "resend" | "console"; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.EMAIL_FROM ?? "bagholders <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(
      "[email/console]",
      JSON.stringify({
        to: args.to,
        subject: args.subject,
        text: args.text ?? args.html,
      }),
    );
    return { ok: true, via: "console" };
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.warn("[email/resend] status", r.status, errText);
      return { ok: false, via: "resend", error: `${r.status}: ${errText}` };
    }
    return { ok: true, via: "resend" };
  } catch (e) {
    console.warn("[email/resend] error", e);
    return {
      ok: false,
      via: "resend",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
