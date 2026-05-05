import { describe, test, expect } from "vitest";
import { getProfileTitle } from "@/lib/title";

const base = {
  total: 0,
  avgBadness: 0,
  worstBadness: 0,
  buyCount: 0,
  sellCount: 0,
};

// ─── 기본 칭호 결정 ──────────────────────────────────────────

describe("getProfileTitle — 기본 칭호", () => {
  test("인증 0건 = '관망 중'", () => {
    const r = getProfileTitle(base);
    expect(r.text).toBe("관망 중");
    expect(r.emoji).toBe("🌱");
  });

  test("최악 90+ = '전설의 고점왕'", () => {
    const r = getProfileTitle({
      ...base,
      total: 1,
      worstBadness: 95,
    });
    expect(r.text).toBe("전설의 고점왕");
    expect(r.emoji).toBe("👑");
  });

  test("최악 70-89 = '고점 임원'", () => {
    const r = getProfileTitle({ ...base, total: 1, worstBadness: 75 });
    expect(r.text).toBe("고점 임원");
  });

  test("최악 50-69 = '반토막 베테랑'", () => {
    const r = getProfileTitle({ ...base, total: 1, worstBadness: 55 });
    expect(r.text).toBe("반토막 베테랑");
  });

  test("10건+ 평균 30+ = '고점 정직원'", () => {
    const r = getProfileTitle({
      ...base,
      total: 12,
      avgBadness: 35,
      worstBadness: 40, // 50 미만
    });
    expect(r.text).toBe("고점 정직원");
  });

  test("5건+ 평균 10+ = '고점 인턴'", () => {
    const r = getProfileTitle({
      ...base,
      total: 6,
      avgBadness: 15,
      worstBadness: 20,
    });
    expect(r.text).toBe("고점 인턴");
  });

  test("3건+ 평균 음수 = '수상하게 잘 맞힘'", () => {
    const r = getProfileTitle({
      ...base,
      total: 5,
      avgBadness: -10,
      worstBadness: 0,
    });
    expect(r.text).toBe("수상하게 잘 맞힘");
    expect(r.sub).toBe("여기 왜 옴?");
  });

  test("3건+ 평범한 손실 = '입문 판독기'", () => {
    const r = getProfileTitle({
      ...base,
      total: 3,
      avgBadness: 5,
      worstBadness: 10,
    });
    expect(r.text).toBe("입문 판독기");
  });

  test("1-2건 = '씨앗'", () => {
    const r = getProfileTitle({
      ...base,
      total: 1,
      avgBadness: 5,
      worstBadness: 10,
    });
    expect(r.text).toBe("씨앗");
  });
});

// ─── 매수/매도 편향 부제 ────────────────────────────────────

describe("getProfileTitle — 매수/매도 편향 sub", () => {
  test("매수만 3+ = '매수만 함'", () => {
    const r = getProfileTitle({
      ...base,
      total: 3,
      avgBadness: 5,
      worstBadness: 10,
      buyCount: 3,
      sellCount: 0,
    });
    expect(r.sub).toContain("매수만 함");
  });

  test("매도만 3+ = '매도만 함'", () => {
    const r = getProfileTitle({
      ...base,
      total: 3,
      avgBadness: 5,
      worstBadness: 10,
      buyCount: 0,
      sellCount: 3,
    });
    expect(r.sub).toContain("매도만 함");
  });

  test("매수가 매도의 3배+ AND 매수 5+ = '고점 매수 전문'", () => {
    const r = getProfileTitle({
      ...base,
      total: 7,
      avgBadness: 5,
      worstBadness: 20,
      buyCount: 6,
      sellCount: 1, // 6 >= 1*3 AND 6 >= 5
    });
    expect(r.sub).toContain("고점 매수 전문");
  });

  test("매도가 매수의 3배+ AND 매도 5+ = '저점 매도 전문'", () => {
    const r = getProfileTitle({
      ...base,
      total: 7,
      avgBadness: 5,
      worstBadness: 20,
      buyCount: 1,
      sellCount: 6,
    });
    expect(r.sub).toContain("저점 매도 전문");
  });

  test("균형잡힌 매수/매도 = 부제에 편향 안 붙음", () => {
    const r = getProfileTitle({
      ...base,
      total: 6,
      avgBadness: 5,
      worstBadness: 20,
      buyCount: 3,
      sellCount: 3,
    });
    expect(r.sub ?? "").not.toMatch(/매수|매도/);
  });

  test("기존 sub와 편향 sub은 ' · '로 결합", () => {
    // worstBadness 95 → '거의 상폐를 보유함' sub 있음
    const r = getProfileTitle({
      ...base,
      total: 6,
      avgBadness: 5,
      worstBadness: 95,
      buyCount: 6,
      sellCount: 0,
    });
    expect(r.sub).toContain("거의 상폐");
    expect(r.sub).toContain("매수만 함");
    expect(r.sub).toContain("·");
  });
});
