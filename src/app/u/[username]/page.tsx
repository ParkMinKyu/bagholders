import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  aggregateByTicker,
  badnessScore,
  getUserByUsername,
  listUserPosts,
} from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { TickerSummary } from "@/components/TickerSummary";
import { damageEquivalent, fmtKRWShort } from "@/lib/format";
import { getProfileTitle } from "@/lib/title";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const target = await getUserByUsername(decodeURIComponent(username));
  if (!target) notFound();

  const viewer = await getCurrentUser();
  const posts = await listUserPosts(target.id, viewer?.id ?? null);

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
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-2xl font-black">@{target.username}</h1>
          <span className="text-sm font-bold text-bag-gold">
            {title.emoji} {title.text}
          </span>
        </div>
        <p className="text-bag-mute text-sm mt-1">
          {title.sub
            ? title.sub
            : viewer?.id === target.id
              ? "당신의 손실 자서전입니다."
              : "이 사람이 사는 코인, 잠시 관망을 추천합니다."}
        </p>

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

        {hasDamage && (
          <div className="mt-4 rounded-md border border-bag-border bg-black/40 p-3 flex items-baseline justify-between">
            <div>
              <div className="text-[11px] text-bag-mute uppercase tracking-wide">
                💀 통장 누적 데미지
              </div>
              <div className="text-[10px] text-bag-mute opacity-70 mt-0.5">
                평가손익 + 기회손익 합산 (자조 점수)
              </div>
            </div>
            <div className="text-right">
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
                <PostCard key={p.id} post={p} isAuthed={!!viewer} />
              ))}
            </div>
          </div>
        </>
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
