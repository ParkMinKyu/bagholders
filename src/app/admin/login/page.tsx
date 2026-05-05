import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

// build marker: 030ff9f deploy
export const metadata: Metadata = {
  title: "관리자 로그인",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; sent?: string }>;
}) {
  const me = await getCurrentAdmin();
  if (me) redirect("/admin");
  const sp = await searchParams;

  return (
    <div className="max-w-sm mx-auto panel p-6 mt-10 space-y-4">
      <h1 className="text-xl font-black">🛡 관리자 로그인</h1>
      <p className="text-bag-mute text-xs">
        등록된 관리자 이메일로만 인증 코드가 발송됩니다.
      </p>

      {sp.error && (
        <div className="text-bag-accent text-sm border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}
      {sp.sent && (
        <div className="text-emerald-400 text-sm border border-emerald-400/40 bg-emerald-400/10 rounded p-2">
          이메일을 확인하고 6자리 코드를 입력해주세요.
        </div>
      )}

      <form
        method="post"
        action="/api/admin/request-code"
        className="space-y-3"
      >
        <div>
          <label className="text-xs text-bag-mute">이메일</label>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            defaultValue={sp.email ?? ""}
            className="input mt-1"
            placeholder="admin@example.com"
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          인증 코드 받기
        </button>
      </form>
    </div>
  );
}
