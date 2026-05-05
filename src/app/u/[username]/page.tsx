import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import {
  aggregateByTicker,
  badnessScore,
  getUserByUsername,
  getUserRank,
  listUserPosts,
} from "@/lib/posts";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getFollowCounts, isFollowing } from "@/lib/follows";
import { getFavoriteCount } from "@/lib/favorites";
import { listGuestbook } from "@/lib/guestbook";
import { PostCard } from "@/components/PostCard";
import { TickerSummary } from "@/components/TickerSummary";
import { GuestbookPanel } from "@/components/GuestbookPanel";
import { damageEquivalent, fmtKRWShort, pctHumor } from "@/lib/format";
import { getProfileTitle } from "@/lib/title";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);
  const target = await getUserByUsername(username);
  if (!target) return { title: "사용자 없음", robots: { index: false } };
  const title = `@${target.username}`;
  const description = `${target.username}의 손실 인증 자서전 — 고점매수·저점매도 기록`;
  const url = `/u/${target.username}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} · bagholders.`, description, url, type: "profile" },
    twitter: { title: `${title} · bagholders.`, description },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  // target 조회와 viewer 세션 조회는 독립적이므로 병렬화.
  const [target, viewer] = await Promise.all([
    getUserByUsername(decodeURIComponent(username)),
    getCurrentUser(),
  ]);
  if (!target) notFound();

  const isSelf = !!viewer && viewer.id === target.id;
  const [posts, followCounts, viewerFollowsTarget, favCount, rankInfo, guestbook, admin] = await Promise.all([
    listUserPosts(target.id, viewer?.id ?? null),
    getFollowCounts(target.id),
    viewer && !isSelf ? isFollowing(viewer.id, target.id) : Promise.resolve(false),
    getFavoriteCount(target.id),
    getUserRank(target.id),
    listGuestbook(target.id, 100),
    getCurrentAdmin(),
  ]);

  const total = posts.length;
  const scores = posts.map((p) => badnessScore(p.kind, Number(p.pnl_pct)));
  const avg = total === 0 ? 0 : scores.reduce((s, n) => s + n, 0) / total;
  const worst = total === 0 ? 0 : Math.max(...scores);
  const buyCount = posts.filter((p) => p.kind === "buy_high").length;
  const sellCount = total - buyCount;
  const tickerStats = aggregateByTicker(posts);

  const title = getProfileTitle({
    total,
    avgBadness: avg,
    worstBadness: worst,
    buyCount,
    sellCount,
  });

  // 통장 누적 데미지: 모든 포스트의 손익을 망함 부호로 통일해 합산
  // (정식 P&L 아님, 자조용 합산)
  const totalDamageKRW = posts.reduce((sum, p) => {
    if (p.quantity == null) return sum;
    const qty = Number(p.quantity);
    if (!isFinite(qty) || qty <= 0) return sum;
    const entry = Number(p.entry_price);
    const last = Number(p.last_price);
    const contrib =
      p.kind === "buy_high" ? (last - entry) * qty : (entry - last) * qty;
    return sum + contrib;
  }, 0);
  const hasDamage = posts.some(
    (p) => p.quantity != null && Number(p.quantity) > 0,
  );

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <h1 className="text-2xl font-black truncate">@{target.username}</h1>
            <span className="text-sm font-bold text-bag-gold">
              {title.emoji} {title.text}
            </span>
            {rankInfo && (
              <Link
                href="/ranking"
                prefetch={false}
                title={`평균 망함도 ${rankInfo.badness_avg >= 0 ? "+" : ""}${rankInfo.badness_avg.toFixed(2)}`}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition ${
                  rankInfo.rank <= 3
                    ? "border-bag-gold bg-bag-gold/10 text-bag-gold hover:bg-bag-gold/20"
                    : rankInfo.rank <= 10
                      ? "border-bag-accent/60 bg-bag-accent/10 text-bag-accent hover:bg-bag-accent/20"
                      : "border-bag-border bg-black/30 text-bag-mute hover:text-white"
                }`}
              >
                <span>
                  {rankInfo.rank === 1
                    ? "🥇"
                    : rankInfo.rank === 2
                      ? "🥈"
                      : rankInfo.rank === 3
                        ? "🥉"
                        : "🏆"}
                </span>
                <span>
                  {rankInfo.rank}위
                  <span className="opacity-70 font-normal">/{rankInfo.total}</span>
                </span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <GuestbookPanel
              ownerId={target.id}
              ownerUsername={target.username}
              isSelf={isSelf}
              isAuthed={!!viewer}
              initial={guestbook.map((g) => ({
                id: g.id,
                author_username: g.author_username,
                body: g.body,
                created_at: g.created_at,
              }))}
            />
            {viewer && !isSelf && (
              <form action="/api/follow" method="post">
                <input type="hidden" name="username" value={target.username} />
                <input
                  type="hidden"
                  name="action"
                  value={viewerFollowsTarget ? "unfollow" : "follow"}
                />
                <button
                  type="submit"
                  className={
                    viewerFollowsTarget
                      ? "btn !py-1 !px-3 text-xs"
                      : "btn-primary !py-1 !px-3 text-xs"
                  }
                >
                  {viewerFollowsTarget ? "✓ 팔로잉" : "+ 팔로우"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-bag-mute text-sm mt-1">
          {title.sub
            ? title.sub
            : isSelf
              ? "당신의 손실 자서전입니다."
              : "이 사람이 사는 코인, 잠시 관망을 추천합니다."}
        </p>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href={`/u/${target.username}/followers`}
            prefetch={false}
            className="hover:text-bag-accent"
          >
            <span className="font-bold">{followCounts.followers}</span>
            <span className="text-bag-mute ml-1">팔로워</span>
          </Link>
          <Link
            href={`/u/${target.username}/following`}
            prefetch={false}
            className="hover:text-bag-accent"
          >
            <span className="font-bold">{followCounts.following}</span>
            <span className="text-bag-mute ml-1">팔로잉</span>
          </Link>
          <Link
            href={`/u/${target.username}/favorites`}
            prefetch={false}
            className="hover:text-bag-accent"
          >
            <span className="font-bold">★ {favCount}</span>
            <span className="text-bag-mute ml-1">즐겨찾기</span>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat
            label="쪽팔린 횟수"
            value={`${total}건`}
            sub={total > 0 ? `🤡 ${buyCount} · 😭 ${sellCount}` : undefined}
          />
          <Stat
            label="평균 망함도"
            value={`${avg >= 0 ? "+" : ""}${avg.toFixed(1)}`}
            tone={avg > 30 ? "loss" : avg > 0 ? "warn" : "mute"}
          />
          <Stat
            label="흑역사 최고기록"
            value={`${worst >= 0 ? "+" : ""}${worst.toFixed(1)}`}
            tone={worst > 50 ? "loss" : worst > 0 ? "warn" : "mute"}
          />
        </div>

        {total > 0 && (
          <div className="mt-4 rounded-md border border-bag-border bg-black/40 p-3 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] text-bag-mute uppercase tracking-wide">
                💀 통장 누적 데미지
              </div>
              <div className="text-[10px] text-bag-mute opacity-70 mt-0.5">
                {hasDamage
                  ? "평가손익 + 기회손익 합산 (자조 점수)"
                  : "수량 모름 — 정신 데미지 평균만 측정"}
              </div>
            </div>
            <div className="text-right">
              {hasDamage ? (
                <>
                  <div
                    className={`text-2xl font-black font-mono ${
                      totalDamageKRW < 0
                        ? "text-red-400"
                        : totalDamageKRW > 0
                          ? "text-emerald-400"
                          : "text-bag-mute"
                    }`}
                  >
                    {totalDamageKRW >= 0 ? "+" : "-"}
                    {fmtKRWShort(Math.abs(totalDamageKRW))}
                  </div>
                  {damageEquivalent(totalDamageKRW) && (
                    <div className="text-[11px] text-bag-mute mt-0.5">
                      ≈ {damageEquivalent(totalDamageKRW)}{" "}
                      {totalDamageKRW < 0 ? "날렸음" : "운빨로 벌었음"}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div
                    className={`text-2xl font-black font-mono ${
                      -avg < 0
                        ? "text-red-400"
                        : -avg > 0
                          ? "text-emerald-400"
                          : "text-bag-mute"
                    }`}
                  >
                    {-avg >= 0 ? "+" : ""}
                    {(-avg).toFixed(1)}%
                  </div>
                  {pctHumor(-avg) && (
                    <div className="text-[11px] text-bag-mute mt-0.5">
                      ≈ {pctHumor(-avg)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {posts.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          {viewer?.id === target.id
            ? "아직 자수하지 않으셨네요. 첫 인증 가시죠."
            : "아직 등록된 인증이 없습니다. 의심스러움."}
        </div>
      ) : (
        <>
          <TickerSummary stats={tickerStats} />
          <div>
            <div className="flex items-baseline justify-between mb-2 px-1">
              <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider">
                인증 타임라인
              </h2>
              <span className="text-[11px] text-bag-mute">{posts.length}건</span>
            </div>
            <div className="space-y-3">
              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  isAuthed={!!viewer}
                  isAdmin={!!admin}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {isSelf && (
        <div className="text-center pt-4">
          <Link
            href="/account"
            prefetch={false}
            className="text-[11px] text-bag-mute hover:text-bag-accent opacity-70"
          >
            ⚙️ 계정 설정
          </Link>
        </div>
      )}
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
    <div className="rounded-md border border-bag-border bg-black/30 py-3">
      <div className="text-[11px] text-bag-mute uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-black mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-bag-mute mt-0.5">{sub}</div>}
    </div>
  );
}
