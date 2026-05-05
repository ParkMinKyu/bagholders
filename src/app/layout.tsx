import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "내가사면떨어져 — 고점 판독기 명예의 전당",
  description: "내가 사면 떨어지고 내가 팔면 오른다. 자조적 매매 인증 SNS.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-bag-border bg-black/40 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-black text-lg tracking-tight">
              <span className="text-bag-accent">📉</span> 내가사면떨어져
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" prefetch={false} className="hover:text-bag-accent">피드</Link>
              <span className="text-bag-mute">·</span>
              <Link href="/ranking" prefetch={false} className="hover:text-bag-accent">랭킹</Link>
              {user ? (
                <>
                  <span className="text-bag-mute">·</span>
                  <Link href="/post/new" prefetch={false} className="text-bag-gold hover:text-yellow-400">
                    + 인증
                  </Link>
                  <span className="text-bag-mute">·</span>
                  <Link href={`/u/${user.username}`} prefetch={false} className="hover:text-bag-accent">
                    {user.username}
                  </Link>
                  <form action="/api/auth/logout" method="post" className="inline">
                    <button className="text-bag-mute hover:text-white ml-1" type="submit">
                      로그아웃
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <span className="text-bag-mute">·</span>
                  <Link href="/login" prefetch={false} className="hover:text-bag-accent">로그인</Link>
                  <Link href="/signup" prefetch={false} className="btn-primary !py-1 !px-2 ml-1 text-xs">
                    시작
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
        <footer className="border-t border-bag-border text-bag-mute text-xs py-6 px-4">
          <div className="mx-auto max-w-3xl space-y-1">
            <p>
              본 사이트는 <strong>투자 정보를 제공하지 않으며</strong>, 모든 게시물은 사용자가
              작성한 유머 콘텐츠입니다. 어떠한 게시물도 매매 추천·전망·분석이 아닙니다.
            </p>
            <p>
              가격은 사용자가 직접 입력한 값이며 실제 시세와 다를 수 있습니다. 투자 판단의 책임은
              본인에게 있습니다.
            </p>
            <p className="opacity-70">© {new Date().getFullYear()} 내가사면떨어져 · for the lulz</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
