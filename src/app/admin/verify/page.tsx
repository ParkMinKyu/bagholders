import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자 인증",
  robots: { index: false, follow: false },
};

export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const me = await getCurrentAdmin();
  if (me) redirect("/admin");
  const sp = await searchParams;
  if (!sp.email) redirect("/admin/login");

  return (
    <div className="max-w-sm mx-auto panel p-6 mt-10 space-y-4">
      <h1 className="text-xl font-black">🛡 코드 입력</h1>
      <p className="text-bag-mute text-xs">
        <strong className="text-white">{sp.email}</strong> 로 발송된 6자리
        코드를 입력해주세요. (10분 유효)
      </p>

      {sp.error && (
        <div className="text-bag-accent text-sm border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}

      <form method="post" action="/api/admin/verify" className="space-y-3">
        <input type="hidden" name="email" value={sp.email} />
        <div>
          <label className="text-xs text-bag-mute">인증번호 (6자리)</label>
          <input
            type="text"
            name="code"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            className="input mt-1 font-mono text-lg tracking-[0.4em] text-center"
            placeholder="000000"
            autoFocus
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          인증
        </button>
      </form>

      <p className="text-xs text-bag-mute text-center">
        <Link
          href="/admin/login"
          prefetch={false}
          className="hover:text-bag-accent"
        >
          이메일 다시 입력
        </Link>
      </p>
    </div>
  );
}
