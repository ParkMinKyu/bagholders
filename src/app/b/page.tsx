import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import {
  listBoardPosts,
  type BoardHotPeriod,
  type BoardSort,
} from "@/lib/board";
import {
  BOARD_CATEGORIES,
  BOARD_PAGE_SIZE,
  categoryLabel,
} from "@/lib/board-config";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "갤러리",
  description: "잡담·질문·시황·짤방 — 자유 게시판. 추천순으로 오늘의 인기 글 모아보기.",
  alternates: { canonical: "/b" },
  openGraph: {
    title: "갤러리 · bagholders.",
    description: "잡담·질문·시황·짤방 — 자유 게시판.",
    url: "/b",
  },
};

const HOT_PERIODS: { key: BoardHotPeriod; label: string }[] = [
  { key: "day", label: "오늘" },
  { key: "week", label: "이번주" },
  { key: "month", label: "이번달" },
];

export default async function BoardListPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; category?: string; period?: string }>;
}) {
  const sp = await searchParams;
  const sort: BoardSort = sp.sort === "hot" ? "hot" : "latest";
  const category = sp.category && BOARD_CATEGORIES.some((c) => c.key === sp.category)
    ? sp.category
    : undefined;
  const period: BoardHotPeriod =
    sp.period === "week" ? "week" : sp.period === "month" ? "month" : "day";

  const [user, posts] = await Promise.all([
    getCurrentUser(),
    listBoardPosts({ sort, category, period, limit: BOARD_PAGE_SIZE }),
  ]);

  const buildHref = (next: { sort?: BoardSort; category?: string; period?: BoardHotPeriod }) => {
    const params = new URLSearchParams();
    if (next.sort && next.sort !== "latest") params.set("sort", next.sort);
    if (next.category) params.set("category", next.category);
    if (next.sort === "hot" && next.period) params.set("period", next.period);
    const q = params.toString();
    return q ? `/b?${q}` : "/b";
  };

  return (
    <div className="space-y-4">
      <section className="panel p-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">📋 갤러리</h1>
          <p className="text-bag-mute text-sm mt-1">
            잡담, 질문, 시황 — 자유롭게.
          </p>
        </div>
        {user ? (
          <Link href="/b/new" prefetch={false} className="btn-primary !py-1.5 !px-3 text-xs">
            ✏️ 글쓰기
          </Link>
        ) : (
          <Link href="/login" prefetch={false} className="btn !py-1.5 !px-3 text-xs">
            로그인 후 글쓰기
          </Link>
        )}
      </section>

      <nav
        role="tablist"
        aria-label="정렬"
        className="panel p-1 flex gap-1 sticky top-[57px] z-[5]"
      >
        <Link
          href={buildHref({ sort: "latest", category })}
          prefetch={false}
          aria-selected={sort === "latest"}
          className={`flex-1 text-center text-sm font-bold py-2 rounded-md transition ${
            sort === "latest"
              ? "bg-bag-accent/15 text-bag-accent"
              : "text-bag-mute hover:text-white hover:bg-white/5"
          }`}
        >
          최신
        </Link>
        <Link
          href={buildHref({ sort: "hot", category, period })}
          prefetch={false}
          aria-selected={sort === "hot"}
          className={`flex-1 text-center text-sm font-bold py-2 rounded-md transition ${
            sort === "hot"
              ? "bg-bag-gold/15 text-bag-gold"
              : "text-bag-mute hover:text-white hover:bg-white/5"
          }`}
        >
          🔥 추천순
        </Link>
      </nav>

      <div className="flex flex-wrap gap-1.5 px-1">
        <Link
          href={buildHref({ sort, period })}
          prefetch={false}
          className={`badge ${
            !category
              ? "border-bag-accent text-bag-accent"
              : "border-bag-border text-bag-mute hover:text-white"
          }`}
        >
          전체
        </Link>
        {BOARD_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={buildHref({ sort, category: c.key, period })}
            prefetch={false}
            className={`badge ${
              category === c.key
                ? "border-bag-accent text-bag-accent"
                : "border-bag-border text-bag-mute hover:text-white"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {sort === "hot" && (
        <div className="flex gap-1.5 px-1">
          {HOT_PERIODS.map((p) => (
            <Link
              key={p.key}
              href={buildHref({ sort: "hot", category, period: p.key })}
              prefetch={false}
              className={`text-[11px] px-2 py-0.5 rounded-md border transition ${
                period === p.key
                  ? "border-bag-gold text-bag-gold bg-bag-gold/10"
                  : "border-bag-border text-bag-mute hover:text-white"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          {sort === "hot"
            ? "이 기간엔 추천받은 글이 없습니다."
            : "아직 글이 없습니다. 첫 글을 써보세요."}
        </div>
      ) : (
        <ol className="panel divide-y divide-bag-border">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/b/${p.id}`}
                prefetch={false}
                className="flex items-baseline gap-2 px-3 py-2.5 hover:bg-bag-accent/5 transition"
              >
                <span className="text-[10px] text-bag-mute border border-bag-border rounded px-1.5 py-0.5 flex-shrink-0">
                  {categoryLabel(p.category)}
                </span>
                <span className="font-medium text-sm flex-1 truncate">
                  {p.title}
                  {p.has_image && <span className="ml-1 text-bag-mute">📷</span>}
                  {p.comment_count > 0 && (
                    <span className="ml-1.5 text-[11px] text-bag-accent font-mono">
                      [{p.comment_count}]
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] font-mono w-10 text-right flex-shrink-0 ${
                    p.score > 0
                      ? "text-emerald-400"
                      : p.score < 0
                        ? "text-red-400"
                        : "text-bag-mute"
                  }`}
                >
                  {p.score > 0 ? `+${p.score}` : p.score}
                </span>
                <span
                  className={`text-[11px] w-16 text-right flex-shrink-0 truncate ${
                    p.is_anon ? "text-bag-mute" : "text-white/80"
                  }`}
                >
                  {p.display_name}
                </span>
                <span className="text-[10px] text-bag-mute w-12 text-right flex-shrink-0">
                  {fmtTime(p.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
