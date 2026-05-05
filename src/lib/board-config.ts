// 클라/서버 모두 import 가능 (DB 의존성 없음).
export const BOARD_CATEGORIES = [
  { key: "free", label: "잡담" },
  { key: "q", label: "질문" },
  { key: "info", label: "정보" },
  { key: "pic", label: "짤방" },
  { key: "market", label: "시황" },
] as const;

export type BoardCategoryKey = (typeof BOARD_CATEGORIES)[number]["key"];

export const BOARD_CATEGORY_KEYS: readonly string[] = BOARD_CATEGORIES.map(
  (c) => c.key,
);

export function categoryLabel(key: string): string {
  return BOARD_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export const BOARD_TITLE_MAX = 80;
export const BOARD_BODY_MAX = 5000;
export const BOARD_COMMENT_MAX = 500;
export const BOARD_NICK_MAX = 16;
export const BOARD_PAGE_SIZE = 30;
