import Link from "next/link";
import { REACTIONS, type FeedPost } from "@/lib/posts";
import { fmtTime, fmtKRW, fmtKRWShort } from "@/lib/format";

function buyHighMessage(displayPnl: number) {
  if (displayPnl <= -80) return "거의 상폐";
  if (displayPnl <= -50) return "반토막+α";
  if (displayPnl <= -30) return "삼가 고인의";
  if (displayPnl <= -10) return "물렸음";
  if (displayPnl < 0) return "눈물 한 방울";
  if (displayPnl === 0) return "본전";
  return "운빨 익절";
}

function sellLowMessage(displayPnl: number) {
  if (displayPnl <= -200) return "n배 가즈아 반대 방향";
  if (displayPnl <= -100) return "팔자마자 더블";
  if (displayPnl <= -50) return "팔자마자 떡상";
  if (displayPnl <= -20) return "조금만 참을걸";
  if (displayPnl < 0) return "약손해";
  if (displayPnl === 0) return "본전";
  return "잘 팔았네";
}

export function PostCard({
  post,
  isAuthed,
}: {
  post: FeedPost;
  isAuthed: boolean;
}) {
  const isBuyHigh = post.kind === "buy_high";
  const rawPnl = Number(post.pnl_pct);
  const entry = Number(post.entry_price);
  const last = Number(post.last_price);
  const qty = post.quantity == null ? null : Number(post.quantity);

  // 저점매도는 매도가 > 현재가가 잘 판 케이스(이익).
  // 두 모드 모두 음수 = 망함, 양수 = 이익으로 통일해서 표시.
  const displayPnl = isBuyHigh ? rawPnl : -rawPnl;
  const rawKRW = qty !== null && isFinite(qty) ? (last - entry) * qty : null;
  const displayKRW = rawKRW === null ? null : isBuyHigh ? rawKRW : -rawKRW;

  const accentBorder = isBuyHigh ? "border-bag-accent/40" : "border-sky-400/40";
  const pnlClass =
    displayPnl <= -50
      ? "text-red-500"
      : displayPnl < 0
        ? "text-red-400"
        : displayPnl > 0
          ? "text-emerald-400"
          : "text-bag-mute";
  const message = isBuyHigh ? buyHighMessage(displayPnl) : sellLowMessage(displayPnl);

  return (
    <article className={`panel p-4 space-y-3 border-l-4 ${accentBorder}`}>
      <header className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Link href={`/u/${post.username}`} className="font-bold hover:text-bag-accent">
            {post.username}
          </Link>
          <span
            className={`badge ${
              isBuyHigh
                ? "border-bag-accent/40 text-bag-accent"
                : "border-sky-400/40 text-sky-300"
            }`}
          >
            {isBuyHigh ? "🤡 고점매수" : "😭 저점매도"}
          </span>
        </div>
        <span className="text-bag-mute text-xs">{fmtTime(Number(post.created_at))}</span>
      </header>

      <div>
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <span className="text-lg font-black">{post.ticker_name}</span>
            <span className="ml-2 text-xs text-bag-mute font-mono">
              {post.ticker_symbol}
            </span>
          </div>
          <div className={`text-2xl font-black ${pnlClass}`}>
            {displayPnl >= 0 ? "+" : ""}
            {displayPnl.toFixed(2)}%
            <span className="text-xs font-medium ml-1 opacity-75">{message}</span>
          </div>
        </div>
        <div className="text-xs text-bag-mute mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <span>
            {isBuyHigh ? "매수가" : "매도가"}{" "}
            <span className="text-white font-mono">{fmtKRW(entry)}</span>
          </span>
          <span className="opacity-60">→</span>
          <span>
            현재가 <span className="text-white font-mono">{fmtKRW(last)}</span>
          </span>
          {qty !== null && <span>· 수량 {qty.toLocaleString("ko-KR")}</span>}
          {displayKRW !== null && (
            <span className={pnlClass}>
              · {isBuyHigh ? "평가손익" : "기회손익"}{" "}
              {displayKRW >= 0 ? "+" : "-"}
              {fmtKRWShort(Math.abs(displayKRW))}
            </span>
          )}
          <span className="opacity-50 ml-auto">
            시세 {fmtTime(Number(post.last_priced_at))}
          </span>
        </div>
        {post.comment && (
          <p className="mt-3 text-sm whitespace-pre-wrap leading-relaxed">{post.comment}</p>
        )}
      </div>

      <footer className="flex flex-wrap gap-2 pt-2 border-t border-bag-border">
        {REACTIONS.map((r) => {
          const count = post.reaction_counts[r.kind] ?? 0;
          const mine = post.my_reactions.includes(r.kind);
          return (
            <form
              key={r.kind}
              action="/api/posts/react"
              method="post"
              className="inline-flex"
            >
              <input type="hidden" name="post_id" value={post.id} />
              <input type="hidden" name="kind" value={r.kind} />
              <button
                type="submit"
                disabled={!isAuthed}
                title={isAuthed ? r.label : "로그인 후 누를 수 있습니다"}
                className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition ${
                  mine
                    ? "border-bag-accent bg-bag-accent/15 text-bag-accent"
                    : "border-bag-border hover:border-bag-accent hover:text-bag-accent"
                } ${!isAuthed ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <span>{r.emoji}</span>
                <span>{r.label}</span>
                {count > 0 && <span className="font-mono">{count}</span>}
              </button>
            </form>
          );
        })}
      </footer>
    </article>
  );
}
