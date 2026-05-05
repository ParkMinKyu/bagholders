import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "회원 탈퇴",
  description: "계정과 관련 데이터를 영구 삭제합니다.",
  robots: { index: false, follow: false },
};

export default async function WithdrawPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const sp = await searchParams;

  return (
    <div className="max-w-lg mx-auto panel p-6 space-y-4">
      <div className="text-xs text-bag-mute">
        <Link
          href={`/u/${me.username}`}
          prefetch={false}
          className="hover:text-bag-accent"
        >
          ← @{me.username}
        </Link>
      </div>

      <h1 className="text-xl font-black">회원 탈퇴</h1>

      <div className="border border-bag-accent/40 bg-red-500/5 rounded-md p-3 text-sm space-y-2">
        <p className="font-bold text-bag-accent">⚠️ 탈퇴 시 영구 삭제됩니다</p>
        <ul className="list-disc pl-5 text-bag-mute space-y-0.5 text-xs">
          <li>계정(@{me.username})과 비밀번호</li>
          <li>작성한 인증 글·코멘트·리액션</li>
          <li>받은 방명록 및 작성한 방명록</li>
          <li>팔로우/팔로워 관계, 즐겨찾기, 갤러리 추천</li>
        </ul>
        <p className="text-bag-mute text-xs">
          단, 갤러리(/b)에 작성한 글과 댓글은 다른 이용자의 토론 흐름 보존을
          위해 <strong className="text-white">작성자 익명 처리</strong>되며,
          본문은 그대로 유지됩니다. 즉시 삭제를 원하시면 탈퇴 전에 직접
          삭제해주시거나{" "}
          <a
            href="mailto:smartmingue@gmail.com"
            className="text-bag-accent hover:underline"
          >
            smartmingue@gmail.com
          </a>
          으로 요청해주세요.
        </p>
      </div>

      {sp.error && (
        <div className="text-bag-accent text-sm border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}

      <form
        method="post"
        action="/api/auth/withdraw"
        className="space-y-3"
      >
        <div>
          <label className="text-xs text-bag-mute">비밀번호</label>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="input mt-1"
            placeholder="현재 비밀번호"
          />
        </div>
        <div>
          <label className="text-xs text-bag-mute">
            확인을 위해 <strong className="text-white">탈퇴합니다</strong>를
            입력해주세요
          </label>
          <input
            type="text"
            name="confirm"
            required
            autoComplete="off"
            className="input mt-1"
            placeholder="탈퇴합니다"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Link
            href={`/u/${me.username}`}
            prefetch={false}
            className="btn flex-1 text-center"
          >
            취소
          </Link>
          <button type="submit" className="btn-primary flex-1">
            영구 탈퇴
          </button>
        </div>
      </form>
    </div>
  );
}
