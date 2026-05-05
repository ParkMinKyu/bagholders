import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { badnessScore, listTickerPosts } from "@/lib/posts";
import { isFavorited } from "@/lib/favorites";
import { PostCard } from "@/components/PostCard";
import { fmtKRW, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code: raw } = await params;
  const tickerCode = decodeURIComponent(raw);
  // 첫 게시물에서 이름/심볼 끌어옴 — 인증 없는 코인은 404 처리됨
  const posts = await listTickerPosts(tickerCode, null, 1);
  if (posts.length === 0) return { title: "코인 없음", robots: { index: false } };
  const p = posts[0];
  const title = `${p.ticker_name} (${p.ticker_symbol}) 인증 모음`;
  const description = `${p.ticker_name}에 물린 사람들의 인증. 평가손익·기회손익을 한눈에.`;
  const url = `/t/${tickerCode}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} · bagholders.`, description, url, type: "article" },
    twitter: { title: `${title} · bagholders.`, description },
  };
}

export default async function TickerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const tickerCode = decodeURIComponent(rawCode);

  // viewer 결과가 my_reactions 조회에 필요하므로 직렬. 단 getCurrentUser는
  // React.cache라 layout과 dedupe됨.
  const viewer = await getCurrentUser();
  const [posts, viewerFavorited] = await Promise.all([
    listTickerPosts(tickerCode, viewer?.id ?? null),
    viewer ? isFavorited(viewer.id, tickerCode) : Promise.resolve(false),
  ]);

  if (posts.length === 0) {
    notFound();
  }

  const fresh = posts[0];
  const tickerName = fresh.ticker_name;
  const tickerSymbol = fresh.ticker_symbol;

  const buyCount = posts.filter((p) => p.kind === "buy_high").length;
  const sellCount = posts.length - buyCount;
  const scores = posts.map((p) => badnessScore(p.kind, Number(p.pnl_pct)));
  const avgBadness = scores.reduce((s, n) => s + n, 0) / scores.length;
  const worstBadness = Math.max(...scores);

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <h1 className="text-2xl font-black truncate">{tickerName}</h1>
            <span className="text-sm font-mono text-bag-mute">{tickerSymbol}</span>
          </div>
          {viewer && (
            <form action="/api/coins/favorite" method="post" className="flex-shrink-0">
              <input type="hidden" name="ticker_code" value={tickerCode} />
              <input type="hidden" name="ticker_symbol" value={tickerSymbol} />
              <input type="hidden" name="ticker_name" value={tickerName} />
              <input
                type="hidden"
                name="action"
                value={viewerFavorited ? "unfavorite" : "favorite"}
              />
              <button
                type="submit"
                aria-label={viewerFavorited ? "즐겨찾기 해제" : "즐겨찾기"}
                className={
                  viewerFavorited
                    ? "btn !py-1 !px-3 text-xs !border-bag-gold !text-bag-gold"
                    : "btn !py-1 !px-3 text-xs"
                }
              >
                {viewerFavorited ? "★ 즐겨찾기됨" : "☆ 즐겨찾기"}
              </button>
            </form>
          )}
        </div>
        <p className="text-bag-mute text-sm mt-1">
          이 코인에 물린 사람들의 인증 모음. 시세는 5분마다 자동 갱신.
        </p>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <Stat label="현재가" value={fmtKRW(Number(fresh.last_price))} />
          <Stat label="총 인증" value={`${posts.length}건`} sub={`🤡 ${buyCount} · 😭 ${sellCount}`} />
          <Stat
            label="평균 망함도"
            value={`${avgBadness >= 0 ? "+" : ""}${avgBadness.toFixed(1)}`}
            tone={avgBadness > 30 ? "loss" : avgBadness > 0 ? "warn" : "mute"}
          />
          <Stat
            label="최고기록"
            value={`${worstBadness >= 0 ? "+" : ""}${worstBadness.toFixed(1)}`}
            tone={worstBadness > 50 ? "loss" : worstBadness > 0 ? "warn" : "mute"}
          />
        </div>

        <p className="text-[11px] text-bag-mute mt-3 opacity-70">
          시세 갱신: {fmtTime(Number(fresh.last_priced_at))}
        </p>
      </section>

      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider">
          인증 타임라인
        </h2>
        <Link
          href={`/search?q=${encodeURIComponent(tickerSymbol)}`}
          prefetch={false}
          className="text-[11px] text-bag-mute hover:text-bag-accent"
        >
          ← 검색으로 돌아가기
        </Link>
      </div>
      <div className="space-y-3">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} isAuthed={!!viewer} />
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "mute",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "loss" | "warn" | "mute";
}) {
  const color =
    tone === "loss"
      ? "text-red-400"
      : tone === "warn"
        ? "text-red-300"
        : "text-white";
  return (
    <div className="rounded-md border border-bag-border bg-black/30 py-3 px-2">
      <div className="text-[10px] text-bag-mute uppercase tracking-wide">{label}</div>
      <div className={`text-base font-black mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-bag-mute mt-0.5">{sub}</div>}
    </div>
  );
}
