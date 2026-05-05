import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bagholders.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "bagholders. — 손실 인증 커뮤니티",
    template: "%s · bagholders.",
  },
  description:
    "고점매수, 저점매도. 인증으로 남기는 자조 SNS — 코인 시세 5분마다 자동 갱신.",
  keywords: [
    "코인",
    "비트코인",
    "이더리움",
    "고점매수",
    "저점매도",
    "물렸음",
    "손실인증",
    "코인 커뮤니티",
    "갤러리",
    "bagholders",
  ],
  applicationName: "bagholders.",
  authors: [{ name: "bagholders." }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "bagholders.",
    title: "bagholders. — 손실 인증 커뮤니티",
    description: "고점매수, 저점매도. 인증으로 남기는 자조 SNS.",
  },
  twitter: {
    card: "summary",
    title: "bagholders.",
    description: "고점매수, 저점매도. 인증으로 남기는 자조 SNS.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0e10",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-bag-border bg-black/40 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-2">
            <Link
              href="/"
              className="font-black text-lg tracking-tight flex-shrink-0 lowercase"
            >
              <span className="hidden sm:inline">bagholders</span>
              <span className="sm:hidden">bag</span>
              <span className="text-bag-accent">.</span>
            </Link>
            <form
              action="/search"
              method="get"
              role="search"
              className="flex-1 min-w-0 max-w-xs"
            >
              <input
                type="search"
                name="q"
                placeholder="🔎 사용자/코인 검색"
                aria-label="사용자 또는 코인 검색"
                maxLength={50}
                className="input !py-1 !px-2 text-xs w-full"
              />
            </form>
            <nav className="flex items-center gap-1.5 text-xs sm:text-sm flex-shrink-0">
              <Link href="/" prefetch={false} className="hover:text-bag-accent">피드</Link>
              <span className="text-bag-mute">·</span>
              <Link href="/b" prefetch={false} className="hover:text-bag-accent">갤러리</Link>
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
            <p className="opacity-70">© {new Date().getFullYear()} bagholders. · for the lulz</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
