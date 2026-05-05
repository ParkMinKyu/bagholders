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
type Tab = "users" | "coins";

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab: Tab = sp.tab === "coins" ? "coins" : "users";

  // 활성 탭에 필요한 쿼리만 실행 (불필요한 DB 라운드트립 절감).
  await refreshAllStaleTickers();
  const [viewer, rows, coins] = await Promise.all([
    getCurrentUser(),
    tab === "users" ? getRanking(null, 50) : Promise.resolve([]),
    tab === "coins" ? getCoinRanking(50) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h1 className="text-2xl font-black">🏆 고점/저점 판독기 명예의 전당</h1>
        <p className="text-bag-mute text-sm mt-1">
          평가가 가혹할수록 윗자리. 시세는 5분마다 자동 갱신.
        </p>
      </section>

      <nav
        role="tablist"
        aria-label="랭킹 종류"
        className="panel p-1 flex gap-1 sticky top-[57px] z-[5]"
      >
        <TabLink current={tab} value="users" label="👤 사용자" />
        <TabLink current={tab} value="coins" label="🪙 코인" />
      </nav>

      {tab === "users" ? (
        rows.length === 0 ? (
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
                  className="font-bold hover:text-bag-accent flex-1 truncate"
                >
                  {r.username}
                </Link>
                <span className="text-xs text-bag-mute whitespace-nowrap">
                  {r.post_count}건
                </span>
                <span className="text-xs text-bag-mute hidden sm:inline whitespace-nowrap">
                  최악 {Number(r.badness_worst).toFixed(1)}
                </span>
                <span
                  className={`font-mono font-black w-20 sm:w-24 text-right ${
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
        )
      ) : coins.length === 0 ? (
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
                <span className="text-xs text-bag-mute whitespace-nowrap">
                  {c.post_count}건
                </span>
                <span
                  className={`font-mono font-black w-16 sm:w-20 text-right ${
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
    </div>
  );
}

function TabLink({
  current,
  value,
  label,
}: {
  current: Tab;
  value: Tab;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      href={value === "users" ? "/ranking" : `/ranking?tab=${value}`}
      prefetch={false}
      role="tab"
      aria-selected={active}
      className={`flex-1 text-center text-sm font-bold py-2 rounded-md transition ${
        active
          ? "bg-bag-accent/15 text-bag-accent"
          : "text-bag-mute hover:text-white hover:bg-white/5"
      }`}
    >
      {label}
    </Link>
  );
}
