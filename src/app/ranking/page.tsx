import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getCoinRanking,
  getRanking,
  refreshAllStaleTickers,
} from "@/lib/posts";
import { fmtKRW } from "@/lib/format";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function RankingPage() {
  // 시세 갱신 1회로 두 랭킹 쿼리 공유 (이후 SELECT는 병렬).
  await refreshAllStaleTickers();
  const [viewer, rows, coins] = await Promise.all([
    getCurrentUser(),
    getRanking(null, 50),
    getCoinRanking(20),
  ]);

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h1 className="text-2xl font-black">🏆 고점/저점 판독기 명예의 전당</h1>
        <p className="text-bag-mute text-sm mt-1">
          평가가 가혹할수록 윗자리. 점수 = 매수자는 손실률, 매도자는 기회손실률.
          시세는 5분마다 자동 갱신됩니다.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider">
            👤 사용자 랭킹
          </h2>
          <span className="text-[11px] text-bag-mute">{rows.length}명</span>
        </div>
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
                <Link
                  href={`/u/${r.username}`}
                  prefetch={false}
                  className="font-bold hover:text-bag-accent flex-1"
                >
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
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider">
            🪙 가장 많이 물린 코인
          </h2>
          <span className="text-[11px] text-bag-mute">{coins.length}종</span>
        </div>
        {coins.length === 0 ? (
          <div className="panel p-8 text-center text-bag-mute text-sm">
            아직 인증된 코인이 없습니다.
          </div>
        ) : (
          <ol className="panel divide-y divide-bag-border">
            {coins.map((c, i) => (
              <li key={c.ticker_code}>
                <Link
                  href={`/t/${encodeURIComponent(c.ticker_code)}`}
                  prefetch={false}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-bag-accent/5 transition"
                >
                  <span className="w-8 text-center text-lg font-black">
                    {MEDALS[i] ?? <span className="text-bag-mute text-sm">{i + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">
                      {c.ticker_name}
                      <span className="ml-2 text-xs text-bag-mute font-mono">
                        {c.ticker_symbol}
                      </span>
                    </div>
                    <div className="text-[11px] text-bag-mute mt-0.5 flex flex-wrap gap-x-2">
                      <span>🤡 {c.buy_count}</span>
                      <span>😭 {c.sell_count}</span>
                      {c.last_price > 0 && (
                        <span className="font-mono text-white/80">
                          {fmtKRW(c.last_price)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-bag-mute">
                    인증 {c.post_count}건
                  </span>
                  <span
                    className={`font-mono font-black w-20 text-right hidden sm:inline ${
                      c.badness_avg >= 30
                        ? "text-red-500"
                        : c.badness_avg > 0
                          ? "text-red-400"
                          : "text-emerald-400"
                    }`}
                  >
                    {c.badness_avg >= 0 ? "+" : ""}
                    {c.badness_avg.toFixed(1)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
