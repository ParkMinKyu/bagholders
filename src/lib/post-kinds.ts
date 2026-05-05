export const POST_KINDS = [
  {
    key: "buy_high" as const,
    label: "고점 매수 인증",
    short: "🤡 고점매수",
    priceLabel: "내가 매수한 가격",
    desc: "샀더니 떨어졌다",
  },
  {
    key: "sell_low" as const,
    label: "저점 매도 인증",
    short: "😭 저점매도",
    priceLabel: "내가 매도한 가격",
    desc: "팔았더니 올랐다",
  },
] as const;

export type PostKind = (typeof POST_KINDS)[number]["key"];

export const REACTIONS = [
  { kind: "kkk", emoji: "🤣", label: "ㅋㅋㅋㅋ" },
  { kind: "rip", emoji: "🪦", label: "삼가 고인의 명복을" },
  { kind: "wallet", emoji: "💸", label: "통장은 안녕하신가요" },
  { kind: "noway", emoji: "🙅", label: "어림도 없지" },
  { kind: "tear", emoji: "😭", label: "눈물이 앞을 가린다" },
] as const;

export type ReactionKind = (typeof REACTIONS)[number]["kind"];

export const PRICE_STALE_MS = 5 * 60 * 1000;

export function calcPnlPct(entry: number, current: number): number {
  if (!isFinite(entry) || entry <= 0 || !isFinite(current)) return 0;
  return ((current - entry) / entry) * 100;
}

export function badnessScore(kind: PostKind, pnlPct: number): number {
  return kind === "buy_high" ? -pnlPct : pnlPct;
}
