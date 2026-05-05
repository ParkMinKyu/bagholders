import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { listFeed } from "@/lib/posts";
import { FEED_PAGE_SIZE } from "@/lib/feed-config";
import { FeedList } from "@/components/FeedList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [user, admin] = await Promise.all([getCurrentUser(), getCurrentAdmin()]);
  const posts = await listFeed(user?.id ?? null, FEED_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <section className="panel p-6 bg-gradient-to-br from-bag-panel to-black/60">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight lowercase">
          bagholders<span className="text-bag-accent">.</span>
        </h1>
        <p className="text-bag-mute text-sm mt-2">
          내가 사면 떨어진다. 손실을 기록하는 자조 SNS — 시세 5분마다 자동 갱신.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {user ? (
            <>
              <Link href="/post/new?kind=buy_high" prefetch={false} className="btn-primary">
                🤡 고점 매수 인증
              </Link>
              <Link
                href="/post/new?kind=sell_low"
                prefetch={false}
                className="btn !border-sky-400 !text-sky-300 hover:!bg-sky-400/10"
              >
                😭 저점 매도 인증
              </Link>
            </>
          ) : (
            <>
              <Link href="/signup" prefetch={false} className="btn-primary">
                고점 판독기로 등록
              </Link>
              <Link href="/login" prefetch={false} className="btn">
                로그인
              </Link>
            </>
          )}
          <Link href="/ranking" prefetch={false} className="btn">
            🏆 명예의 전당
          </Link>
        </div>
      </section>

      <FeedList initial={posts} isAuthed={!!user} isAdmin={!!admin} />
    </div>
  );
}
