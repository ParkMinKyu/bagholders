import type { TickerStat, TickerSideStat } from "@/lib/posts";
import { damageEquivalent, fmtKRW, fmtKRWShort, fmtTime } from "@/lib/format";

function pnlColor(n: number) {
  if (n <= -50) return "text-red-500";
  if (n < 0) return "text-red-400";
  if (n > 0) return "text-emerald-400";
  return "text-bag-mute";
}

export function TickerSummary({ stats }: { stats: TickerStat[] }) {
  if (stats.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider">
          종목별 종합
        </h2>
        <span className="text-[11px] text-bag-mute">{stats.length}개 종목</span>
      </div>
      <div className="space-y-2">
        {stats.map((s) => (
          <TickerRow key={s.ticker_code} stat={s} />
        ))}
      </div>
    </section>
  );
}

function TickerRow({ stat }: { stat: TickerStat }) {
  return (
    <div className="panel p-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div>
          <span className="font-bold">{stat.ticker_name}</span>
          <span className="ml-2 text-[11px] font-mono text-bag-mute">
            {stat.ticker_symbol}
          </span>
          <span className="ml-2 text-[10px] text-bag-mute">
            인증 {stat.total_count}건
          </span>
        </div>
        <div className="text-xs text-bag-mute">
          현재{" "}
          <span className="text-white font-mono">{fmtKRW(stat.last_price)}</span>
          <span className="ml-1 opacity-60">· {fmtTime(stat.last_priced_at)}</span>
        </div>
      </div>

      {stat.buy.count > 0 && (
        <SideRow label="🤡 매수" tone="buy" side={stat.buy} />
      )}
      {stat.sell.count > 0 && (
        <SideRow label="😭 매도" tone="sell" side={stat.sell} />
      )}

      {stat.has_any_qty && <DamageRow krw={stat.net_pnl_krw} />}
    </div>
  );
}

function DamageRow({ krw }: { krw: number }) {
  const negative = krw < 0;
  const positive = krw > 0;
  const eq = damageEquivalent(krw);
  return (
    <div className="flex items-baseline justify-between pt-2 mt-2 border-t border-bag-border text-xs">
      <span className="text-bag-mute" title="평가손익(보유중) + 기회손익(청산 후 가상)의 합. 정식 회계 기준 아닌 자조 점수.">
        💀 통장 데미지
      </span>
      <div className="text-right">
        <span
          className={`font-mono font-black ${
            negative ? "text-red-400" : positive ? "text-emerald-400" : "text-bag-mute"
          }`}
        >
          {krw >= 0 ? "+" : "-"}
          {fmtKRWShort(Math.abs(krw))}
        </span>
        {eq && (
          <div className="text-[10px] text-bag-mute mt-0.5">
            ≈ {eq} {negative ? "날렸음" : "운빨로 벌었음"}
          </div>
        )}
      </div>
    </div>
  );
}

function SideRow({
  label,
  tone,
  side,
}: {
  label: string;
  tone: "buy" | "sell";
  side: TickerSideStat;
}) {
  const badgeCls =
    tone === "buy"
      ? "border-bag-accent/40 text-bag-accent"
      : "border-sky-400/40 text-sky-300";
  return (
    <div className="text-xs flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-bag-border/40">
      <span className={`badge ${badgeCls}`}>
        {label} {side.count}건
      </span>
      <span className="text-bag-mute">
        평균{" "}
        <span className="text-white font-mono">{fmtKRW(side.avg_entry)}</span>
      </span>
      {side.has_qty && (
        <span className="text-bag-mute">
          · 총수량{" "}
          <span className="text-white font-mono">
            {side.total_qty.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}
          </span>
        </span>
      )}
      <span className={`font-mono ${pnlColor(side.avg_display_pnl)}`}>
        평균 {side.avg_display_pnl >= 0 ? "+" : ""}
        {side.avg_display_pnl.toFixed(2)}%
      </span>
      {side.has_qty && (
        <span className={`font-mono ${pnlColor(side.pnl_krw)}`}>
          · {tone === "buy" ? "평가" : "기회"}{" "}
          {side.pnl_krw >= 0 ? "+" : "-"}
          {fmtKRWShort(Math.abs(side.pnl_krw))}
        </span>
      )}
    </div>
  );
}
