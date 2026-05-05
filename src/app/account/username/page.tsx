import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "닉네임 변경",
  robots: { index: false, follow: false },
};

export default async function UsernamePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
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
      <h1 className="text-xl font-black">닉네임 변경</h1>

      <div className="border border-bag-border bg-black/20 rounded-md p-3 text-xs text-bag-mute space-y-1">
        <p>
          현재 닉네임:{" "}
          <span className="font-bold text-white">@{me.username}</span>
        </p>
        <p>
          ⚠️ 변경 시 기존 프로필 URL <code className="font-mono">/u/{me.username}</code>{" "}
          은 더 이상 작동하지 않습니다. 외부에 공유한 링크는 끊어질 수 있어요.
        </p>
      </div>

      {sp.error && (
        <div className="text-bag-accent text-sm border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}

      <form method="post" action="/api/auth/username" className="space-y-3">
        <div>
          <label className="text-xs text-bag-mute">새 닉네임 (2~16자)</label>
          <input
            type="text"
            name="username"
            required
            maxLength={16}
            autoComplete="username"
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-bag-mute">현재 비밀번호</label>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
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
