import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserByUsername, listUserPosts, badnessScore } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";

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

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h1 className="text-2xl font-black">@{target.username}</h1>
        <p className="text-bag-mute text-sm mt-1">
          {viewer?.id === target.id
            ? "당신의 손실 자서전입니다."
            : "이 사람이 사는 코인, 잠시 관망을 추천합니다."}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat
            label="인증 횟수"
            value={`${total}건`}
            sub={total > 0 ? `🤡 ${buyCount} · 😭 ${sellCount}` : undefined}
          />
          <Stat
            label="평균 점수"
            value={`${avg >= 0 ? "+" : ""}${avg.toFixed(1)}`}
            tone={avg > 30 ? "loss" : avg > 0 ? "warn" : "mute"}
          />
          <Stat
            label="최악의 픽"
            value={`+${worst.toFixed(1)}`}
            tone={worst > 30 ? "loss" : worst > 0 ? "warn" : "mute"}
          />
        </div>
      </section>

      {posts.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          아직 등록된 인증이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} isAuthed={!!viewer} />
          ))}
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
