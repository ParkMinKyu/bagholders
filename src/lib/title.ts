export type ProfileTitle = {
  emoji: string;
  text: string;
  sub?: string;
};

export function getProfileTitle(args: {
  total: number;
  avgBadness: number;
  worstBadness: number;
  buyCount: number;
  sellCount: number;
}): ProfileTitle {
  const { total, avgBadness, worstBadness, buyCount, sellCount } = args;

  if (total === 0) {
    return { emoji: "🌱", text: "관망 중", sub: "아직 손실을 인증하지 않음" };
  }

  let base: ProfileTitle;
  if (worstBadness >= 90) {
    base = { emoji: "👑", text: "전설의 고점왕", sub: "거의 상폐를 보유함" };
  } else if (worstBadness >= 70) {
    base = { emoji: "💀", text: "고점 임원", sub: "상폐 코앞" };
  } else if (worstBadness >= 50) {
    base = { emoji: "🪦", text: "반토막 베테랑" };
  } else if (total >= 10 && avgBadness >= 30) {
    base = { emoji: "📉", text: "고점 정직원" };
  } else if (total >= 5 && avgBadness >= 10) {
    base = { emoji: "🤡", text: "고점 인턴" };
  } else if (total >= 3 && avgBadness < 0) {
    base = { emoji: "🎯", text: "수상하게 잘 맞힘", sub: "여기 왜 옴?" };
  } else if (total >= 3) {
    base = { emoji: "🐣", text: "입문 판독기" };
  } else {
    base = { emoji: "🌱", text: "씨앗" };
  }

  // 매수/매도 편향 라벨 추가
  if (buyCount >= 3 && sellCount === 0) {
    base = { ...base, sub: base.sub ? `${base.sub} · 매수만 함` : "매수만 함" };
  } else if (sellCount >= 3 && buyCount === 0) {
    base = { ...base, sub: base.sub ? `${base.sub} · 매도만 함` : "매도만 함" };
  } else if (buyCount >= sellCount * 3 && buyCount >= 5) {
    base = {
      ...base,
      sub: base.sub ? `${base.sub} · 고점 매수 전문` : "고점 매수 전문",
    };
  } else if (sellCount >= buyCount * 3 && sellCount >= 5) {
    base = {
      ...base,
      sub: base.sub ? `${base.sub} · 저점 매도 전문` : "저점 매도 전문",
    };
  }

  return base;
}
