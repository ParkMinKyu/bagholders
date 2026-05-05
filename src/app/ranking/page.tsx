import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getRanking } from "@/lib/posts";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function RankingPage() {
  const viewer = await getCurrentUser();
  const rows = await getRanking(viewer?.id ?? null, 50);

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h1 className="text-2xl font-black">🏆 고점/저점 판독기 명예의 전당</h1>
        <p className="text-bag-mute text-sm mt-1">
          평가가 가혹할수록 윗자리. 점수 = 매수자는 손실률, 매도자는 기회손실률.
          시세는 5분마다 자동 갱신됩니다.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          아직 랭킹 데이터가 없습니다. 첫 등록자가 되세요.
        </div>
      ) : (
        <ol className="panel divide-y divide-bag-border">
          {rows.map((r, i) => (
            <li
              key={r.user_id}
              className={`flex items-center gap-3 px-4 py-3 ${
                viewer?.id === r.user_id ? "bg-bag-accent/5" : ""
              }`}
            >
              <span className="w-8 text-center text-lg font-black">
                {MEDALS[i] ?? <span className="text-bag-mute text-sm">{i + 1}</span>}
              </span>
              <Link href={`/u/${r.username}`} className="font-bold hover:text-bag-accent flex-1">
                {r.username}
              </Link>
              <span className="text-xs text-bag-mute">인증 {r.post_count}건</span>
              <span className="text-xs text-bag-mute hidden sm:inline">
                최악 {Number(r.badness_worst).toFixed(1)}
              </span>
              <span
                className={`font-mono font-black w-24 text-right ${
                  r.badness_avg >= 30
                    ? "text-red-500"
                    : r.badness_avg > 0
                      ? "text-red-400"
                      : "text-emerald-400"
                }`}
              >
                {r.badness_avg >= 0 ? "+" : ""}
                {Number(r.badness_avg).toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
