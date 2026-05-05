import { describe, test, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@libsql/client", () => ({
  createClient: () => ({
    execute: vi.fn(async () => ({ rows: [], rowsAffected: 0 })),
    batch: vi.fn(async () => undefined),
  }),
}));

import { likePattern } from "@/lib/posts";

// ─── likePattern — SQL LIKE wildcard injection 방어 ──────────

describe("likePattern — LIKE 와일드카드 escape", () => {
  test("일반 문자열은 양옆에 % 추가", () => {
    expect(likePattern("btc")).toBe("%btc%");
    expect(likePattern("비트코인")).toBe("%비트코인%");
  });

  test("% 이스케이프 (와일드카드 주입 방어)", () => {
    // 사용자가 '%admin%'를 검색해도 그대로 문자열로 매칭돼야 함
    expect(likePattern("100%")).toBe("%100\\%%");
    expect(likePattern("%admin%")).toBe("%\\%admin\\%%");
  });

  test("_ 이스케이프 (단일 와일드카드)", () => {
    expect(likePattern("a_b")).toBe("%a\\_b%");
    expect(likePattern("user_123")).toBe("%user\\_123%");
  });

  test("백슬래시 자체도 이스케이프", () => {
    expect(likePattern("a\\b")).toBe("%a\\\\b%");
  });

  test("복합 케이스 — % _ \\ 모두 포함", () => {
    expect(likePattern("a%b_c\\d")).toBe("%a\\%b\\_c\\\\d%");
  });

  test("빈 문자열도 그냥 통과", () => {
    expect(likePattern("")).toBe("%%");
  });

  test("정상적인 사용자 검색어는 변형 없음", () => {
    expect(likePattern("BTC ETH")).toBe("%BTC ETH%");
    expect(likePattern("도지코인")).toBe("%도지코인%");
  });
});
