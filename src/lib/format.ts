export function fmtTime(ts: number): string {
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

export function fmtKRW(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1_000_000) return `₩${Math.round(n).toLocaleString("ko-KR")}`;
  if (n >= 1) return `₩${n.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
  return `₩${n.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}`;
}

export function fmtKRWShort(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  return Math.round(n).toLocaleString("ko-KR");
}
