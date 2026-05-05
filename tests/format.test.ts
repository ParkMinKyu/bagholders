import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import {
  fmtKRW,
  fmtKRWShort,
  fmtTime,
  damageEquivalent,
  pctHumor,
} from "@/lib/format";

// ─── fmtKRW ──────────────────────────────────────────────────

describe("fmtKRW — 원화 풀 표기", () => {
  test("isFinite 아닌 값은 '—'", () => {
    expect(fmtKRW(Infinity)).toBe("—");
    expect(fmtKRW(-Infinity)).toBe("—");
    expect(fmtKRW(NaN)).toBe("—");
  });
  test("100만 이상은 정수 + 콤마", () => {
    expect(fmtKRW(150_000_000)).toBe("₩150,000,000");
    expect(fmtKRW(1_500_000)).toBe("₩1,500,000");
  });
  test("1 이상 100만 미만은 소수점 2자리까지", () => {
    expect(fmtKRW(1234)).toBe("₩1,234");
    expect(fmtKRW(99.5)).toBe("₩99.5");
    expect(fmtKRW(99.123)).toBe("₩99.12");
  });
  test("1 미만(=알트코인)은 6자리까지", () => {
    expect(fmtKRW(0.025)).toBe("₩0.025");
    expect(fmtKRW(0.000123)).toBe("₩0.000123");
    expect(fmtKRW(0.0123456789)).toBe("₩0.012346"); // 반올림
  });
  test("0", () => {
    expect(fmtKRW(0)).toBe("₩0");
  });
});

// ─── fmtKRWShort ─────────────────────────────────────────────

describe("fmtKRWShort — 만/억 단위 축약", () => {
  test("1억 이상", () => {
    expect(fmtKRWShort(150_000_000)).toBe("1.5억");
    expect(fmtKRWShort(100_000_000)).toBe("1.0억");
    expect(fmtKRWShort(2_500_000_000)).toBe("25.0억");
  });
  test("1만 이상 1억 미만", () => {
    expect(fmtKRWShort(50_000)).toBe("5.0만");
    expect(fmtKRWShort(15_000_000)).toBe("1500.0만");
    // 99_999_999는 1억 미만이지만 /10000 = 9999.9999 → toFixed(1) → "10000.0"
    expect(fmtKRWShort(99_999_999)).toBe("10000.0만");
  });
  test("1만 미만 — 정수 + 콤마", () => {
    expect(fmtKRWShort(5_000)).toBe("5,000");
    expect(fmtKRWShort(123)).toBe("123");
    expect(fmtKRWShort(0)).toBe("0");
  });
  test("음수도 축약 적용 (절댓값 기준)", () => {
    expect(fmtKRWShort(-150_000_000)).toBe("-1.5억");
    expect(fmtKRWShort(-50_000)).toBe("-5.0만");
  });
  test("isFinite 아닌 값", () => {
    expect(fmtKRWShort(Infinity)).toBe("—");
    expect(fmtKRWShort(NaN)).toBe("—");
  });
});

// ─── damageEquivalent ────────────────────────────────────────

describe("damageEquivalent — 손실액 → 체감 단위 환산", () => {
  test("25,000원 미만은 null (환산 의미 없음)", () => {
    expect(damageEquivalent(0)).toBe(null);
    expect(damageEquivalent(10_000)).toBe(null);
    expect(damageEquivalent(-15_000)).toBe(null); // 절댓값 기준
  });
  test("치킨 단위 (~20만원)", () => {
    expect(damageEquivalent(50_000)).toMatch(/치킨/);
    expect(damageEquivalent(100_000)).toMatch(/치킨/);
    expect(damageEquivalent(-150_000)).toMatch(/치킨/); // 음수 OK
  });
  test("월세 단위 (20만~150만)", () => {
    expect(damageEquivalent(700_000)).toMatch(/월세/);
    expect(damageEquivalent(1_400_000)).toMatch(/월세/);
  });
  test("아이폰 단위 (150만~1500만)", () => {
    expect(damageEquivalent(1_500_000)).toMatch(/아이폰/);
    expect(damageEquivalent(10_000_000)).toMatch(/아이폰/);
  });
  test("아반떼 단위 (1500만~8000만)", () => {
    expect(damageEquivalent(20_000_000)).toMatch(/아반떼/);
    expect(damageEquivalent(70_000_000)).toMatch(/아반떼/);
  });
  test("BMW 단위 (8000만~5억)", () => {
    expect(damageEquivalent(100_000_000)).toMatch(/BMW/);
    expect(damageEquivalent(400_000_000)).toMatch(/BMW/);
  });
  test("강남 아파트 단위 (5억~30억)", () => {
    expect(damageEquivalent(1_000_000_000)).toMatch(/강남.*평/);
    expect(damageEquivalent(2_000_000_000)).toMatch(/강남.*평/);
  });
  test("강남 아파트 채 단위 (30억+)", () => {
    expect(damageEquivalent(5_000_000_000)).toMatch(/강남.*채/);
  });
});

// ─── pctHumor ────────────────────────────────────────────────

describe("pctHumor — % → 유머 멘트", () => {
  test("심각한 손실대", () => {
    expect(pctHumor(-200)).toBeTruthy();
    expect(pctHumor(-100)).toMatch(/팔자마자|떡상|상폐/);
    expect(pctHumor(-80)).toMatch(/상폐/);
    expect(pctHumor(-50)).toMatch(/반토막/);
    expect(pctHumor(-30)).toMatch(/고인/);
    expect(pctHumor(-10)).toMatch(/물렸/);
  });
  test("약손해", () => {
    expect(pctHumor(-1)).toMatch(/약손해/);
  });
  test("본전", () => {
    expect(pctHumor(0)).toMatch(/본전/);
  });
  test("이익대", () => {
    expect(pctHumor(5)).toMatch(/약이익/);
    expect(pctHumor(25)).toMatch(/운빨/);
    expect(pctHumor(60)).toMatch(/수상/);
    expect(pctHumor(150)).toMatch(/진짜 너/);
  });
});

// ─── fmtTime ─────────────────────────────────────────────────

describe("fmtTime — 시간 표시", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  test("1분 미만 = '방금'", () => {
    const now = Date.now();
    expect(fmtTime(now)).toBe("방금");
    expect(fmtTime(now - 30_000)).toBe("방금"); // 30초 전
  });
  test("1시간 미만 = 'N분 전'", () => {
    const now = Date.now();
    expect(fmtTime(now - 60_000)).toBe("1분 전");
    expect(fmtTime(now - 30 * 60_000)).toBe("30분 전");
    expect(fmtTime(now - 59 * 60_000)).toBe("59분 전");
  });
  test("24시간 미만 = 'N시간 전'", () => {
    const now = Date.now();
    expect(fmtTime(now - 60 * 60_000)).toBe("1시간 전");
    expect(fmtTime(now - 23 * 60 * 60_000)).toBe("23시간 전");
  });
  test("7일 미만 = 'N일 전'", () => {
    const now = Date.now();
    expect(fmtTime(now - 24 * 60 * 60_000)).toBe("1일 전");
    expect(fmtTime(now - 6 * 24 * 60 * 60_000)).toBe("6일 전");
  });
  test("7일 이상 = 한국 날짜 (MM. DD. or full)", () => {
    const now = Date.now();
    const old = now - 30 * 24 * 60 * 60_000;
    const out = fmtTime(old);
    // toLocaleDateString("ko-KR") → "2026. 4. 5." 같은 형태
    expect(out).toMatch(/\d{4}|\d+\.\s*\d+/);
    expect(out).not.toBe("방금");
    expect(out).not.toMatch(/\d+분 전|\d+시간 전|\d+일 전/);
  });
});
