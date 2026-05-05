import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listFeed } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const posts = await listFeed(user?.id ?? null, 50);

  return (
    <div className="space-y-4">
      <section className="panel p-5 bg-gradient-to-br from-bag-panel to-black/60">
        <h1 className="text-2xl font-black">📉 내가사면떨어져</h1>
        <p className="text-bag-mute text-sm mt-1">
          내가 사면 떨어지고, 내가 팔면 오른다. 코인 시세 5분마다 자동 갱신.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {user ? (
            <>
              <Link href="/post/new?kind=buy_high" className="btn-primary">
                🤡 고점 매수 인증
              </Link>
              <Link
                href="/post/new?kind=sell_low"
                className="btn !border-sky-400 !text-sky-300 hover:!bg-sky-400/10"
              >
                😭 저점 매도 인증
              </Link>
            </>
          ) : (
            <>
              <Link href="/signup" className="btn-primary">
                고점 판독기로 등록
              </Link>
              <Link href="/login" className="btn">
                로그인
              </Link>
            </>
          )}
          <Link href="/ranking" className="btn">
            🏆 명예의 전당
          </Link>
        </div>
      </section>

      {posts.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          아직 인증된 손실이 없습니다. 첫 번째 고점 판독기가 되어보세요.
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} isAuthed={!!user} />
          ))}
        </div>
      )}
    </div>
  );
}
