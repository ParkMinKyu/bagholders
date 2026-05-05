import { describe, test, expect, beforeEach, vi } from "vitest";

// next/headers는 테스트 환경에서 직접 못 쓴다. 쿠키 stub 제공.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// libsql 클라이언트는 stub. 각 테스트에서 dbGet/dbRun을 mockResolvedValueOnce로 제어.
vi.mock("@libsql/client", () => ({
  createClient: () => ({
    execute: vi.fn(async () => ({ rows: [], rowsAffected: 0 })),
    batch: vi.fn(async () => undefined),
  }),
}));

// DB 헬퍼는 테스트마다 응답 모킹.
vi.mock("@/lib/db", () => ({
  dbGet: vi.fn(),
  dbAll: vi.fn(async () => []),
  dbRun: vi.fn(async () => ({ lastInsertRowid: 1, changes: 1 })),
  dbBatch: vi.fn(async () => undefined),
}));

import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { dbGet } from "@/lib/db";

beforeEach(() => {
  // 글로벌 인메모리 rate-limit 상태 초기화 (다른 테스트와 충돌 방지)
  // @ts-expect-error - 테스트 전용 globalThis 정리
  delete globalThis.__bagAttempts;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.mocked(dbGet).mockReset();
});

// ─── 로그인 라우트 통합 테스트 ──────────────────────────────

describe("/api/auth/login — 통합 동작", () => {
  function makeReq(username: string, password: string, ip = "10.0.0.1") {
    const fd = new FormData();
    fd.set("username", username);
    fd.set("password", password);
    return new Request("http://test.local/api/auth/login", {
      method: "POST",
      body: fd,
      headers: { "x-forwarded-for": ip },
    });
  }

  test("존재하지 않는 사용자: 303 redirect + error 파라미터, 사용자명 노출 X", async () => {
    vi.mocked(dbGet).mockResolvedValue(undefined);
    const res = await loginPOST(makeReq("nonexistent", "anypw12345"));
    expect(res.status).toBe(303);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/login");
    expect(loc).toMatch(/error=/);
    // 일반 메시지 — "사용자 없음" 같이 enumeration 가능한 메시지 X
    const errParam = new URL(loc).searchParams.get("error") ?? "";
    expect(errParam).not.toContain("사용자가 없");
  });

  test("5회 실패 누적 시 잠금 발동 (이후 정답 비밀번호도 거부)", async () => {
    vi.mocked(dbGet).mockResolvedValue(undefined);
    const ip = "10.0.0." + Math.floor(Math.random() * 200 + 30);
    const username = "lockuser_" + Math.random().toString(36).slice(2, 8);

    // 5회 실패까지: 4회는 일반 거부, 5회째에 잠금
    let lastErr = "";
    for (let i = 0; i < 5; i++) {
      const res = await loginPOST(makeReq(username, "badpass" + i, ip));
      expect(res.status).toBe(303);
      const url = new URL(res.headers.get("location") ?? "");
      lastErr = url.searchParams.get("error") ?? "";
    }
    // 5번째 응답에 잠금 메시지
    expect(lastErr).toMatch(/시도|잠금|초과/);

    // 6번째 — 같은 IP+username, 잠긴 상태이므로 "잠금" 응답
    const res6 = await loginPOST(makeReq(username, "anything", ip));
    const url6 = new URL(res6.headers.get("location") ?? "");
    const err6 = url6.searchParams.get("error") ?? "";
    expect(err6).toMatch(/너무 많/);
  });

  test("다른 IP는 별개 카운터 (IP+username 키)", async () => {
    vi.mocked(dbGet).mockResolvedValue(undefined);
    const username = "isolated_" + Math.random().toString(36).slice(2, 8);

    // IP A로 5회 실패 (잠금 도달)
    for (let i = 0; i < 5; i++) {
      await loginPOST(makeReq(username, "x" + i, "10.99.99.1"));
    }
    // IP B로 1회 시도 — 별개 카운터라 잠금 메시지 없어야
    const res = await loginPOST(makeReq(username, "y", "10.99.99.2"));
    const err = new URL(res.headers.get("location") ?? "").searchParams.get("error") ?? "";
    expect(err).not.toMatch(/너무 많/);
  });
});

// ─── 회원가입 라우트 통합 테스트 ────────────────────────────

describe("/api/auth/signup — 입력 검증", () => {
  function makeReq(fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return new Request("http://test.local/api/auth/signup", {
      method: "POST",
      body: fd,
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
  }

  test("이용약관 미동의 거부", async () => {
    vi.mocked(dbGet).mockResolvedValue(undefined);
    const res = await signupPOST(
      makeReq({
        username: "validuser",
        password: "longenough123",
        agree_privacy: "on",
        age_ok: "on",
        // agree_terms 빠짐
      }),
    );
    const err = new URL(res.headers.get("location") ?? "").searchParams.get("error") ?? "";
    expect(err).toMatch(/이용약관/);
  });

  test("개인정보처리방침 미동의 거부", async () => {
    vi.mocked(dbGet).mockResolvedValue(undefined);
    const res = await signupPOST(
      makeReq({
        username: "validuser",
        password: "longenough123",
        agree_terms: "on",
        age_ok: "on",
      }),
    );
    const err = new URL(res.headers.get("location") ?? "").searchParams.get("error") ?? "";
    expect(err).toMatch(/개인정보/);
  });

  test("만 14세 미만 거부", async () => {
    vi.mocked(dbGet).mockResolvedValue(undefined);
    const res = await signupPOST(
      makeReq({
        username: "validuser",
        password: "longenough123",
        agree_terms: "on",
        agree_privacy: "on",
      }),
    );
    const err = new URL(res.headers.get("location") ?? "").searchParams.get("error") ?? "";
    expect(err).toMatch(/14세/);
  });

  test("8자 미만 비밀번호 거부", async () => {
    vi.mocked(dbGet).mockResolvedValue(undefined);
    const res = await signupPOST(
      makeReq({
        username: "validuser",
        password: "short",
        agree_terms: "on",
        agree_privacy: "on",
        age_ok: "on",
      }),
    );
    const err = new URL(res.headers.get("location") ?? "").searchParams.get("error") ?? "";
    expect(err).toMatch(/비밀번호.*8/);
  });

  test("128자 초과 비밀번호 거부", async () => {
    vi.mocked(dbGet).mockResolvedValue(undefined);
    const res = await signupPOST(
      makeReq({
        username: "validuser",
        password: "a".repeat(200),
        agree_terms: "on",
        agree_privacy: "on",
        age_ok: "on",
      }),
    );
    const err = new URL(res.headers.get("location") ?? "").searchParams.get("error") ?? "";
    expect(err).toMatch(/비밀번호.*128/);
  });

  test("부적합한 username 거부 (특수문자)", async () => {
    vi.mocked(dbGet).mockResolvedValue(undefined);
    const res = await signupPOST(
      makeReq({
        username: "user@inject!<script>",
        password: "longenough123",
        agree_terms: "on",
        agree_privacy: "on",
        age_ok: "on",
      }),
    );
    const err = new URL(res.headers.get("location") ?? "").searchParams.get("error") ?? "";
    expect(err).toMatch(/닉네임/);
  });

  test("대소문자 다른 기존 username 중복 차단 (Alice vs alice)", async () => {
    // 기존에 "alice"가 있다고 시뮬레이트.
    vi.mocked(dbGet).mockResolvedValue({ id: 1 } as never);
    const res = await signupPOST(
      makeReq({
        username: "Alice",
        password: "longenough123",
        agree_terms: "on",
        agree_privacy: "on",
        age_ok: "on",
      }),
    );
    const err = new URL(res.headers.get("location") ?? "").searchParams.get("error") ?? "";
    expect(err).toMatch(/이미 존재/);
  });
});
