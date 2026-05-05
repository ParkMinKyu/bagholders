import Link from "next/link";
import { REACTIONS, type FeedPost } from "@/lib/posts";

function fmtTime(ts: number) {
  const diff = Date.now() - ts;
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;
  if (diff < m) return "방금";
  if (diff < h) return `${Math.floor(diff / m)}분 전`;
  if (diff < d) return `${Math.floor(diff / h)}시간 전`;
  if (diff < 7 * d) return `${Math.floor(diff / d)}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

function fmtNum(n: number) {
  if (!isFinite(n)) return "-";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function fmtKRW(n: number) {
  if (!isFinite(n)) return "-";
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}만`;
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function pnlColor(pnl: number) {
  if (pnl <= -50) return "text-red-500";
  if (pnl < 0) return "text-red-400";
  if (pnl > 0) return "text-emerald-400";
  return "text-bag-mute";
}

function pnlMessage(pnl: number) {
  if (pnl <= -80) return "거의 상폐";
  if (pnl <= -50) return "반토막+α";
  if (pnl <= -30) return "삼가 고인의";
  if (pnl <= -10) return "물렸음";
  if (pnl < 0) return "눈물 한 방울";
  if (pnl === 0) return "본전";
  if (pnl > 30) return "운빨";
  return "익절";
}

export function PostCard({
  post,
  isAuthed,
}: {
  post: FeedPost;
  isAuthed: boolean;
}) {
  const lossKRW =
    post.quantity && isFinite(post.quantity)
      ? (post.current_price - post.buy_price) * post.quantity
      : null;

  return (
    <article className="panel p-4 space-y-3">
      <header className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Link href={`/u/${post.username}`} className="font-bold hover:text-bag-accent">
            {post.username}
          </Link>
          <span className="badge text-bag-mute border-bag-border">{post.category}</span>
        </div>
        <span className="text-bag-mute text-xs">{fmtTime(post.created_at)}</span>
      </header>

      <div>
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div className="text-lg font-black">{post.ticker}</div>
          <div className={`text-2xl font-black ${pnlColor(post.pnl_pct)}`}>
            {post.pnl_pct >= 0 ? "+" : ""}
            {post.pnl_pct.toFixed(2)}%
            <span className="text-xs font-medium ml-1 opacity-75">
              {pnlMessage(post.pnl_pct)}
            </span>
          </div>
        </div>
        <div className="text-xs text-bag-mute mt-1 flex flex-wrap gap-3">
          <span>매수가 {fmtNum(post.buy_price)}</span>
          <span>→</span>
          <span>현재가 {fmtNum(post.current_price)}</span>
          {post.quantity != null && <span>· 수량 {fmtNum(post.quantity)}</span>}
          {lossKRW !== null && (
            <span className={pnlColor(post.pnl_pct)}>
              · 평가손익 {lossKRW >= 0 ? "+" : "-"}
              {fmtKRW(Math.abs(lossKRW))}
            </span>
          )}
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
