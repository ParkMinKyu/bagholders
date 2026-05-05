import { describe, test, expect, vi, beforeEach } from "vitest";

// 쿠키 stub.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("@libsql/client", () => ({
  createClient: () => ({
    execute: vi.fn(async () => ({ rows: [], rowsAffected: 0 })),
    batch: vi.fn(async () => undefined),
  }),
}));

// DB stub — 호출 자체는 통과하되, 실제 DB는 안 탐.
vi.mock("@/lib/db", () => ({
  dbGet: vi.fn(async () => undefined),
  dbAll: vi.fn(async () => []),
  dbRun: vi.fn(async () => ({ lastInsertRowid: 1, changes: 1 })),
  dbBatch: vi.fn(async () => undefined),
}));

// auth와 admin-auth의 getCurrent* 만 모킹 — 액션 로직은 그대로 실행되도록.
vi.mock("@/lib/auth", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentUser: vi.fn(async () => null),
  };
});

vi.mock("@/lib/admin-auth", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/admin-auth")>();
  return {
    ...actual,
    getCurrentAdmin: vi.fn(async () => null),
  };
});

import { getCurrentUser } from "@/lib/auth";
import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  toggleReactionAction,
  addCommentAction,
  addGuestbookAction,
  voteBoardPostAction,
  addBoardCommentAction,
  reportAction,
  loadMoreFeedAction,
} from "@/lib/actions";
import {
  adminDeletePostAction,
  adminDeleteBoardPostAction,
  adminDeleteCommentAction,
  adminDeleteBoardCommentAction,
  adminDeleteGuestbookEntryAction,
  adminResolveReportAction,
  adminResolveAndDeleteAction,
} from "@/lib/admin-actions";

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  vi.mocked(getCurrentAdmin).mockResolvedValue(null);
});

// ─── 일반 server action — 비로그인 차단 ──────────────────────

describe("Server actions — 비로그인 차단", () => {
  test("toggleReactionAction: 미인증이면 ok:false", async () => {
    const r = await toggleReactionAction(1, "kkk");
    expect(r.ok).toBe(false);
  });

  test("addCommentAction: 미인증 거부", async () => {
    const r = await addCommentAction(1, "test comment");
    expect(r.ok).toBe(false);
    expect("error" in r && r.error).toMatch(/로그인/);
  });

  test("addGuestbookAction: 미인증 거부", async () => {
    const r = await addGuestbookAction(1, "test");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/로그인/);
  });

  test("voteBoardPostAction: 미인증 거부", async () => {
    const r = await voteBoardPostAction(1, "up");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/로그인/);
  });

  test("addBoardCommentAction: 미인증 거부", async () => {
    const r = await addBoardCommentAction(1, "test", null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/로그인/);
  });

  test("reportAction: 미인증 거부", async () => {
    const r = await reportAction("post", 1, "spam", null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/로그인/);
  });

  test("loadMoreFeedAction: 미인증여도 동작 (피드는 공개) — 빈 배열/배열 반환만 확인", async () => {
    const r = await loadMoreFeedAction(Date.now());
    expect(Array.isArray(r)).toBe(true);
  });
});

// ─── Admin server actions — 비-admin 차단 ────────────────────

describe("Admin actions — admin 세션 없으면 차단", () => {
  test("adminDeletePostAction: 비admin 거부", async () => {
    const r = await adminDeletePostAction(1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/관리자/);
  });

  test("adminDeleteBoardPostAction: 비admin 거부", async () => {
    const r = await adminDeleteBoardPostAction(1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/관리자/);
  });

  test("adminDeleteCommentAction: 비admin 거부", async () => {
    const r = await adminDeleteCommentAction(1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/관리자/);
  });

  test("adminDeleteBoardCommentAction: 비admin 거부", async () => {
    const r = await adminDeleteBoardCommentAction(1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/관리자/);
  });

  test("adminDeleteGuestbookEntryAction: 비admin 거부", async () => {
    const r = await adminDeleteGuestbookEntryAction(1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/관리자/);
  });

  test("adminResolveReportAction: 비admin 거부", async () => {
    const r = await adminResolveReportAction(1, "resolved");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/관리자/);
  });

  test("adminResolveAndDeleteAction: 비admin 거부", async () => {
    const r = await adminResolveAndDeleteAction(1, "post", 1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/관리자/);
  });
});

// ─── 로그인 사용자도 입력 검증 통과해야 ──────────────────────

describe("로그인 상태에서도 입력 검증", () => {
  beforeEach(() => {
    // 가짜 사용자 mock
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 1,
      username: "testuser",
      password_hash: "x",
      bio: "",
      created_at: 0,
    });
  });

  test("addCommentAction: 빈 본문 거부", async () => {
    const r = await addCommentAction(1, "   ");
    expect(r.ok).toBe(false);
    if ("error" in r && r.error) expect(r.error).toMatch(/내용/);
  });

  test("addCommentAction: 잘못된 postId 거부", async () => {
    const r = await addCommentAction(NaN, "valid body");
    expect(r.ok).toBe(false);
  });

  test("voteBoardPostAction: 잘못된 kind 거부", async () => {
    // @ts-expect-error - 의도적으로 잘못된 입력
    const r = await voteBoardPostAction(1, "neither");
    expect(r.ok).toBe(false);
  });

  test("reportAction: 잘못된 target_type 거부", async () => {
    // @ts-expect-error - 의도적으로 잘못된 입력
    const r = await reportAction("invalid_target", 1, "spam", null);
    expect(r.ok).toBe(false);
  });

  test("reportAction: 잘못된 reason 거부", async () => {
    // @ts-expect-error - 의도적으로 잘못된 입력
    const r = await reportAction("post", 1, "made_up", null);
    expect(r.ok).toBe(false);
  });

  test("addGuestbookAction: 잘못된 ownerId(NaN) 거부", async () => {
    const r = await addGuestbookAction(NaN, "hi");
    expect(r.ok).toBe(false);
  });
});
