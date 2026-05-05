import { describe, test, expect } from "vitest";

// FeedPost를 import하면 lib/posts → lib/db → next 의존성 체인 발생.
// aggregateByTicker만 추출 import하는 길은 없으니 vi.mock으로 next/headers 차단 후 import.
import { vi } from "vitest";
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));
vi.mock("@libsql/client", () => ({
  createClient: () => ({
    execute: vi.fn(async () => ({ rows: [], rowsAffected: 0 })),
    batch: vi.fn(async () => undefined),
  }),
}));

import { aggregateByTicker, type FeedPost } from "@/lib/posts";

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: 1,
    user_id: 10,
    username: "tester",
    kind: "buy_high",
    asset_type: "crypto",
    ticker_code: "KRW-BTC",
    ticker_symbol: "BTC",
    ticker_name: "비트코인",
    entry_price: 100,
    last_price: 50,
    last_priced_at: 1_000_000,
    quantity: 1,
    comment: "",
    pnl_pct: -50,
    image_url: null,
    created_at: 1_000_000,
    reaction_counts: {},
    my_reactions: [],
    badness: 50,
    comment_count: 0,
    author_follower_count: 0,
    ...overrides,
  };
}

describe("aggregateByTicker — 티커별 집계", () => {
  test("빈 배열 → 빈 결과", () => {
    expect(aggregateByTicker([])).toEqual([]);
  });

  test("단일 티커, 단일 매수 — 카운트/평균/손익 KRW", () => {
    const stats = aggregateByTicker([
      makePost({
        kind: "buy_high",
        entry_price: 100,
        last_price: 50,
        quantity: 2,
        pnl_pct: -50,
      }),
    ]);
    expect(stats).toHaveLength(1);
    const s = stats[0];
    expect(s.ticker_code).toBe("KRW-BTC");
    expect(s.total_count).toBe(1);
    expect(s.buy.count).toBe(1);
    expect(s.sell.count).toBe(0);
    expect(s.buy.avg_entry).toBe(100);
    expect(s.buy.total_qty).toBe(2);
    expect(s.buy.has_qty).toBe(true);
    // (50 - 100) * 2 = -100
    expect(s.buy.pnl_krw).toBe(-100);
    expect(s.net_pnl_krw).toBe(-100);
    expect(s.has_any_qty).toBe(true);
  });

  test("단일 티커, 매수 + 매도 혼합", () => {
    const stats = aggregateByTicker([
      makePost({
        id: 1,
        kind: "buy_high",
        entry_price: 100,
        last_price: 50,
        quantity: 1,
        pnl_pct: -50,
      }),
      makePost({
        id: 2,
        kind: "sell_low",
        entry_price: 80,
        last_price: 50,
        quantity: 1,
        pnl_pct: -37.5,
      }),
    ]);
    expect(stats[0].buy.count).toBe(1);
    expect(stats[0].sell.count).toBe(1);
    expect(stats[0].total_count).toBe(2);
    // 매수 손익: (50-100)*1 = -50, 매도 기회손익: (80-50)*1 = +30
    expect(stats[0].buy.pnl_krw).toBe(-50);
    expect(stats[0].sell.pnl_krw).toBe(30);
    expect(stats[0].net_pnl_krw).toBe(-20);
  });

  test("매도 사이드의 avg_display_pnl은 부호 반전", () => {
    // sell_low의 raw pnl_pct는 (last-entry)/entry. 매도자 입장에서
    // last > entry면 손실이므로 -로 표시해야 함.
    const stats = aggregateByTicker([
      makePost({
        kind: "sell_low",
        entry_price: 100,
        last_price: 200,
        pnl_pct: 100, // (200-100)/100 = 100
        quantity: null,
      }),
    ]);
    // sell_low display = -rawPnl = -100
    expect(stats[0].sell.avg_display_pnl).toBe(-100);
  });

  test("여러 티커 — total_count 내림차순 정렬", () => {
    const stats = aggregateByTicker([
      makePost({ id: 1, ticker_code: "KRW-BTC" }),
      makePost({ id: 2, ticker_code: "KRW-ETH" }),
      makePost({ id: 3, ticker_code: "KRW-ETH" }),
      makePost({ id: 4, ticker_code: "KRW-DOGE" }),
      makePost({ id: 5, ticker_code: "KRW-DOGE" }),
      makePost({ id: 6, ticker_code: "KRW-DOGE" }),
    ]);
    expect(stats.map((s) => s.ticker_code)).toEqual([
      "KRW-DOGE",
      "KRW-ETH",
      "KRW-BTC",
    ]);
    expect(stats.map((s) => s.total_count)).toEqual([3, 2, 1]);
  });

  test("quantity null이면 has_qty false / pnl_krw 미반영", () => {
    const stats = aggregateByTicker([
      makePost({
        kind: "buy_high",
        entry_price: 100,
        last_price: 50,
        quantity: null,
        pnl_pct: -50,
      }),
    ]);
    expect(stats[0].buy.has_qty).toBe(false);
    expect(stats[0].buy.pnl_krw).toBe(0);
    expect(stats[0].has_any_qty).toBe(false);
  });

  test("quantity 0 또는 음수도 제외", () => {
    const stats = aggregateByTicker([
      makePost({ id: 1, quantity: 0, kind: "buy_high" }),
      makePost({ id: 2, quantity: -1, kind: "buy_high" }),
    ]);
    expect(stats[0].buy.has_qty).toBe(false);
    expect(stats[0].buy.total_qty).toBe(0);
  });

  test("last_priced_at이 가장 최신인 post에서 last_price 가져옴", () => {
    const stats = aggregateByTicker([
      makePost({ id: 1, last_price: 100, last_priced_at: 1000 }),
      makePost({ id: 2, last_price: 200, last_priced_at: 5000 }), // 최신
      makePost({ id: 3, last_price: 150, last_priced_at: 2000 }),
    ]);
    expect(stats[0].last_price).toBe(200);
    expect(stats[0].last_priced_at).toBe(5000);
  });

  test("avg_entry는 단순 평균 (가중 X)", () => {
    const stats = aggregateByTicker([
      makePost({ id: 1, entry_price: 100, kind: "buy_high" }),
      makePost({ id: 2, entry_price: 200, kind: "buy_high" }),
      makePost({ id: 3, entry_price: 300, kind: "buy_high" }),
    ]);
    expect(stats[0].buy.avg_entry).toBe(200); // (100+200+300)/3
  });
});
