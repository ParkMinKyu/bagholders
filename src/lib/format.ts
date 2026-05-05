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

// 손실액을 누구나 체감할 수 있는 단위로 환산. 음수든 양수든 절댓값 기준.
export function damageEquivalent(krw: number): string | null {
  const abs = Math.abs(krw);
  if (abs < 25000) return null;
  if (abs < 200_000) {
    const n = Math.max(1, Math.round(abs / 25_000));
    return `치킨 ${n}마리`;
  }
  if (abs < 1_500_000) {
    const n = (abs / 700_000).toFixed(1);
    return `월세 ${n}달치`;
  }
  if (abs < 15_000_000) {
    const n = Math.max(1, Math.round(abs / 1_500_000));
    return `아이폰 ${n}대`;
  }
  if (abs < 80_000_000) {
    const n = Math.max(1, Math.round(abs / 30_000_000));
    return `아반떼 ${n}대`;
  }
  if (abs < 500_000_000) {
    const n = Math.max(1, Math.round(abs / 80_000_000));
    return `BMW 5시리즈 ${n}대`;
  }
  if (abs < 3_000_000_000) {
    const n = (abs / 100_000_000).toFixed(1);
    return `강남 아파트 ${n}평`;
  }
  return `강남 아파트 ${(abs / 2_500_000_000).toFixed(1)}채`;
}
