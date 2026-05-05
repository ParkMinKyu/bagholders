import { describe, test, expect } from "vitest";
import { calcPnlPct, badnessScore } from "@/lib/post-kinds";

// ─── calcPnlPct — 손익률 계산 ────────────────────────────────

describe("calcPnlPct — 진입가→현재가 % 계산", () => {
  test("동일 가격 = 0%", () => {
    expect(calcPnlPct(100, 100)).toBe(0);
  });
  test("정상 손익률 (+10%)", () => {
    expect(calcPnlPct(100, 110)).toBeCloseTo(10, 6);
  });
  test("정상 손실률 (-50%)", () => {
    expect(calcPnlPct(100, 50)).toBeCloseTo(-50, 6);
  });
  test("거의 0 진입가 (entry <= 0)는 0 반환 (DivisionByZero 방어)", () => {
    expect(calcPnlPct(0, 100)).toBe(0);
    expect(calcPnlPct(-10, 100)).toBe(0);
  });
  test("isFinite 아닌 값 처리", () => {
    expect(calcPnlPct(NaN, 100)).toBe(0);
    expect(calcPnlPct(Infinity, 100)).toBe(0);
    expect(calcPnlPct(100, NaN)).toBe(0);
    expect(calcPnlPct(100, Infinity)).toBe(0);
  });
  test("알트코인 소수점 단가도 정확", () => {
    expect(calcPnlPct(0.001, 0.0015)).toBeCloseTo(50, 3);
    expect(calcPnlPct(0.025, 0.018)).toBeCloseTo(-28, 1);
  });
  test("1000% 같은 큰 수도 정상", () => {
    expect(calcPnlPct(100, 1100)).toBeCloseTo(1000, 3);
  });
});

// ─── badnessScore — 인증 종류별 부호 통일 ────────────────────

describe("badnessScore — buy_high/sell_low 부호 통일", () => {
  test("buy_high은 손실(-) → 망함도(+)", () => {
    expect(badnessScore("buy_high", -50)).toBe(50);
    expect(badnessScore("buy_high", -100)).toBe(100);
  });
  test("buy_high은 이익(+) → 음수 (운빨)", () => {
    expect(badnessScore("buy_high", 30)).toBe(-30);
  });
  test("sell_low는 부호 그대로 (팔고 떡상 = 양수 망함도)", () => {
    expect(badnessScore("sell_low", 100)).toBe(100);
    expect(badnessScore("sell_low", -20)).toBe(-20);
  });
  test("0 그대로 (음의 0 포함)", () => {
    // -pnlPct가 -0을 만들 수 있어 절댓값으로 검사 (랭킹/표시상 무관).
    expect(Math.abs(badnessScore("buy_high", 0))).toBe(0);
    expect(badnessScore("sell_low", 0)).toBe(0);
  });
  test("랭킹 정렬 정합성: 망함도 큰 사람이 위", () => {
    // 동일한 비참함이라면 buy_high -50%와 sell_low +50%는 같아야
    expect(badnessScore("buy_high", -50)).toBe(badnessScore("sell_low", 50));
  });
});
