import Link from "next/link";
import { getRanking } from "@/lib/posts";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function RankingPage() {
  const rows = getRanking(50);
  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h1 className="text-2xl font-black">🏆 고점 판독기 명예의 전당</h1>
        <p className="text-bag-mute text-sm mt-1">
          평균 손익률이 낮을수록 윗자리. 가장 잘 물리는 사람이 우승합니다.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          아직 랭킹 데이터가 없습니다. 첫 등록자가 되세요.
        </div>
      ) : (
        <ol className="panel divide-y divide-bag-border">
          {rows.map((r, i) => (
            <li key={r.user_id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 text-center text-lg font-black">
                {MEDALS[i] ?? <span className="text-bag-mute text-sm">{i + 1}</span>}
              </span>
              <Link href={`/u/${r.username}`} className="font-bold hover:text-bag-accent flex-1">
                {r.username}
              </Link>
              <span className="text-xs text-bag-mute">
                인증 {r.post_count}건
              </span>
              <span className="text-xs text-bag-mute hidden sm:inline">
                최악 {r.worst_loss.toFixed(1)}%
              </span>
              <span
                className={`font-mono font-black w-24 text-right ${
                  r.avg_loss < -30
                    ? "text-red-500"
                    : r.avg_loss < 0
                      ? "text-red-400"
                      : "text-emerald-400"
                }`}
              >
                {r.avg_loss >= 0 ? "+" : ""}
                {r.avg_loss.toFixed(2)}%
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
