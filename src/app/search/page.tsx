import Link from "next/link";
import { searchTickers, searchUsers } from "@/lib/posts";
import { fmtKRW, fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const qRaw = (sp.q ?? "").trim();
  const q = qRaw.slice(0, 50);

  const [users, tickers] =
    q.length === 0
      ? [[], []]
      : await Promise.all([searchUsers(q, 10), searchTickers(q, 10)]);

  const hasResults = users.length > 0 || tickers.length > 0;

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h1 className="text-xl font-black mb-3">🔎 검색</h1>
        <form method="get" action="/search" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            autoFocus
            maxLength={50}
            placeholder="사용자 또는 코인 이름/심볼"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">
            검색
          </button>
        </form>
        {q.length > 0 && (
          <p className="text-bag-mute text-xs mt-2">
            “{q}”에 대한 결과
          </p>
        )}
      </section>

      {q.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          사용자 닉네임이나 코인 심볼/이름으로 검색해보세요. (예: BTC, 비트코인)
        </div>
      ) : !hasResults ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          “{q}”와(과) 일치하는 결과가 없습니다.
        </div>
      ) : (
        <>
          {users.length > 0 && (
            <section className="panel p-4">
              <div className="flex items-baseline justify-between mb-3 px-1">
                <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider">
                  👤 사용자
                </h2>
                <span className="text-[11px] text-bag-mute">{users.length}명</span>
              </div>
              <ol className="divide-y divide-bag-border">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 px-2 py-2.5"
                  >
                    <Link
                      href={`/u/${u.username}`}
                      prefetch={false}
                      className="font-bold hover:text-bag-accent flex-1"
                    >
                      @{u.username}
                    </Link>
                    <span className="text-xs text-bag-mute">
                      인증 {u.post_count}건
                    </span>
                    {u.post_count > 0 && (
                      <span
                        className={`font-mono text-xs w-20 text-right ${
                          u.badness_avg >= 30
                            ? "text-red-500"
                            : u.badness_avg > 0
                              ? "text-red-400"
                              : "text-emerald-400"
                        }`}
                      >
                        {u.badness_avg >= 0 ? "+" : ""}
                        {u.badness_avg.toFixed(1)}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {tickers.length > 0 && (
            <section className="panel p-4">
              <div className="flex items-baseline justify-between mb-3 px-1">
                <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider">
                  🪙 코인
                </h2>
                <span className="text-[11px] text-bag-mute">{tickers.length}종</span>
              </div>
              <ol className="divide-y divide-bag-border">
                {tickers.map((t) => (
                  <li key={t.ticker_code}>
                    <Link
                      href={`/t/${encodeURIComponent(t.ticker_code)}`}
                      prefetch={false}
                      className="flex items-center gap-3 px-2 py-2.5 -mx-2 rounded hover:bg-bag-accent/5 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">
                          {t.ticker_name}
                          <span className="ml-2 text-xs text-bag-mute font-mono">
                            {t.ticker_symbol}
                          </span>
                        </div>
                        <div className="text-[11px] text-bag-mute mt-0.5 flex flex-wrap gap-x-2">
                          <span>🤡 {t.buy_count}</span>
                          <span>😭 {t.sell_count}</span>
                          {t.last_price > 0 && (
                            <>
                              <span className="font-mono text-white/80">
                                {fmtKRW(t.last_price)}
                              </span>
                              <span className="opacity-60">
                                {fmtTime(t.last_priced_at)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-bag-mute flex-shrink-0">
                        인증 {t.post_count}건 →
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
