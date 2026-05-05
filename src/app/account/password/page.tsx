import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "비밀번호 변경",
  robots: { index: false, follow: false },
};

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const sp = await searchParams;

  return (
    <div className="max-w-md mx-auto panel p-6 space-y-4">
      <div className="text-xs text-bag-mute">
        <Link
          href={`/u/${me.username}`}
          prefetch={false}
          className="hover:text-bag-accent"
        >
          ← @{me.username}
        </Link>
      </div>
      <h1 className="text-xl font-black">비밀번호 변경</h1>

      {sp.error && (
        <div className="text-bag-accent text-sm border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}
      {sp.ok && (
        <div className="text-emerald-400 text-sm border border-emerald-400/40 bg-emerald-400/10 rounded p-2">
          {sp.ok}
        </div>
      )}

      <form method="post" action="/api/auth/password" className="space-y-3">
        <div>
          <label className="text-xs text-bag-mute">현재 비밀번호</label>
          <input
            type="password"
            name="current"
            required
            autoComplete="current-password"
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-bag-mute">새 비밀번호 (8~128자)</label>
          <input
            type="password"
            name="next"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-bag-mute">새 비밀번호 확인</label>
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            className="input mt-1"
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          변경
        </button>
      </form>
    </div>
  );
}
