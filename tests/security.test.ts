import { describe, test, expect, beforeEach, vi } from "vitest";

// next/headers는 Next.js 런타임에서만 동작 — 테스트 환경에선 모킹.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// libsql 클라이언트는 실 DB 연결 시도. 단위 테스트엔 stub.
vi.mock("@libsql/client", () => ({
  createClient: () => ({
    execute: vi.fn(async () => ({ rows: [], rowsAffected: 0 })),
    batch: vi.fn(async () => undefined),
  }),
}));

import { safeImageUrl } from "@/lib/format";
import { adminEmailAllowed, generateCode } from "@/lib/admin-auth";
import {
  LOGIN_OPTS,
  REPORT_OPTS,
  checkLocked,
  recordFailure,
  recordSuccess,
  recordHit,
} from "@/lib/rate-limit";

// ─── E. XSS / 이미지 URL 스킴 검증 ────────────────────────────

describe("safeImageUrl — javascript:/data:/file: 등 위험 스킴 차단", () => {
  test("javascript: 거부", () => {
    expect(safeImageUrl("javascript:alert(1)")).toBe(null);
  });
  test("JAVASCRIPT: (대문자) 거부", () => {
    expect(safeImageUrl("JAVASCRIPT:alert(1)")).toBe(null);
  });
  test("data: 거부", () => {
    expect(safeImageUrl("data:text/html,<script>alert(1)</script>")).toBe(null);
  });
  test("file: 거부", () => {
    expect(safeImageUrl("file:///etc/passwd")).toBe(null);
  });
  test("vbscript: 거부", () => {
    expect(safeImageUrl("vbscript:msgbox(1)")).toBe(null);
  });
  test("https URL 통과", () => {
    expect(safeImageUrl("https://example.com/img.jpg")).toBe(
      "https://example.com/img.jpg",
    );
  });
  test("http URL 통과", () => {
    expect(safeImageUrl("http://example.com/img.jpg")).toBe(
      "http://example.com/img.jpg",
    );
  });
  test("malformed URL 거부", () => {
    expect(safeImageUrl("not a url")).toBe(null);
  });
  test("null/undefined/빈 문자열 거부", () => {
    expect(safeImageUrl(null)).toBe(null);
    expect(safeImageUrl(undefined)).toBe(null);
    expect(safeImageUrl("")).toBe(null);
  });
});

// ─── J/N. 관리자 이메일 화이트리스트 ─────────────────────────

describe("adminEmailAllowed — 관리자 이메일 화이트리스트", () => {
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  test("env 미설정 시 무조건 false (기본 안전)", () => {
    expect(adminEmailAllowed("test@example.com")).toBe(false);
  });

  test("env 빈 문자열 시 false", () => {
    process.env.ADMIN_EMAILS = "";
    expect(adminEmailAllowed("test@example.com")).toBe(false);
  });

  test("env 공백만 있을 시 false", () => {
    process.env.ADMIN_EMAILS = "   ,  ,  ";
    expect(adminEmailAllowed("test@example.com")).toBe(false);
  });

  test("미등록 이메일은 false", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(adminEmailAllowed("hacker@example.com")).toBe(false);
  });

  test("등록 이메일 통과", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(adminEmailAllowed("admin@example.com")).toBe(true);
  });

  test("대소문자 무관 매칭 (env 측 대문자)", () => {
    process.env.ADMIN_EMAILS = "Admin@Example.com";
    expect(adminEmailAllowed("admin@example.com")).toBe(true);
  });

  test("대소문자 무관 매칭 (입력 측 대문자)", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(adminEmailAllowed("ADMIN@EXAMPLE.COM")).toBe(true);
  });

  test("trim — 환경변수 양 옆 공백 허용", () => {
    process.env.ADMIN_EMAILS = "  admin@example.com  ";
    expect(adminEmailAllowed("admin@example.com")).toBe(true);
  });

  test("trim — 입력 양 옆 공백 허용", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(adminEmailAllowed("  admin@example.com  ")).toBe(true);
  });

  test("콤마 구분 다수 이메일", () => {
    process.env.ADMIN_EMAILS = "a@x.com,b@y.com,c@z.com";
    expect(adminEmailAllowed("a@x.com")).toBe(true);
    expect(adminEmailAllowed("b@y.com")).toBe(true);
    expect(adminEmailAllowed("c@z.com")).toBe(true);
    expect(adminEmailAllowed("d@w.com")).toBe(false);
  });
});

// ─── J. OTP 코드 생성 ─────────────────────────────────────────

describe("generateCode — 관리자 인증 코드", () => {
  test("정확히 6자리 숫자", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    }
  });

  test("앞자리 0 보존 (000000~999999 균등)", () => {
    // 200회 중 0으로 시작하는 케이스가 1개라도 있어야 (확률 ~10%/회)
    let leadingZero = 0;
    for (let i = 0; i < 200; i++) {
      if (generateCode()[0] === "0") leadingZero++;
    }
    expect(leadingZero).toBeGreaterThan(5); // 통계적으로 매우 보수적인 하한
  });

  test("충분히 다양 (충돌 거의 없음)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) codes.add(generateCode());
    expect(codes.size).toBeGreaterThan(180); // ~6자리 1M 공간이라 200회면 충돌 거의 없음
  });
});

// ─── B/H. Rate Limit (in-memory 경로) ────────────────────────

describe("rate-limit (in-memory)", () => {
  beforeEach(() => {
    // KV env가 있으면 Redis 경로 타니까 정리.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  test("초기엔 잠겨있지 않음", async () => {
    const key = `test-init-${Math.random()}`;
    expect(await checkLocked(key, LOGIN_OPTS)).toBe(null);
  });

  test("MAX_FAILS 도달 시 잠금 발동", async () => {
    const key = `test-lock-${Math.random()}`;
    for (let i = 0; i < LOGIN_OPTS.max - 1; i++) {
      const r = await recordFailure(key, LOGIN_OPTS);
      expect(r.lockedFor).toBe(null);
    }
    const final = await recordFailure(key, LOGIN_OPTS);
    expect(final.lockedFor).toBeGreaterThan(0);

    const stillLocked = await checkLocked(key, LOGIN_OPTS);
    expect(stillLocked).not.toBe(null);
    expect(stillLocked!).toBeGreaterThan(0);
  });

  test("recordSuccess는 카운터 초기화", async () => {
    const key = `test-success-${Math.random()}`;
    await recordFailure(key, LOGIN_OPTS);
    await recordFailure(key, LOGIN_OPTS);
    await recordSuccess(key);
    expect(await checkLocked(key, LOGIN_OPTS)).toBe(null);
    // 새로 시도해도 카운트가 0부터.
    const r = await recordFailure(key, LOGIN_OPTS);
    expect(r.lockedFor).toBe(null);
  });

  test("REPORT_OPTS는 더 엄격한 한도 (LOGIN과 분리)", () => {
    expect(REPORT_OPTS.max).toBeGreaterThanOrEqual(10);
    expect(REPORT_OPTS.windowMs).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });

  test("recordHit은 recordFailure와 동일 (alias)", async () => {
    const key = `test-hit-${Math.random()}`;
    const r = await recordHit(key, REPORT_OPTS);
    expect(r.lockedFor).toBe(null);
  });

  test("LOGIN_OPTS 정책 합리적", () => {
    expect(LOGIN_OPTS.max).toBeGreaterThanOrEqual(3);
    expect(LOGIN_OPTS.max).toBeLessThanOrEqual(10);
    expect(LOGIN_OPTS.lockMs).toBeGreaterThanOrEqual(60_000); // 최소 1분
  });
});

// ─── F. CSP / 보안 헤더 정합성 ───────────────────────────────

describe("next.config.js 보안 헤더 정의", () => {
  test("CSP form-action 'self' (open redirect / phishing 방어)", async () => {
    const conf = await import("../next.config.js" as string);
    const headers = await (conf.default ?? conf).headers();
    const csp = headers[0].headers.find(
      (h: { key: string }) => h.key === "Content-Security-Policy",
    )?.value as string;
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/form-action 'self'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/frame-ancestors 'self'/);
    expect(csp).toMatch(/base-uri 'self'/);
  });

  test("핵심 보안 헤더 모두 존재", async () => {
    const conf = await import("../next.config.js" as string);
    const headers = await (conf.default ?? conf).headers();
    const keys = headers[0].headers.map((h: { key: string }) => h.key);
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Permissions-Policy");
    expect(keys).toContain("Strict-Transport-Security");
  });

  test("X-Frame-Options SAMEORIGIN/DENY", async () => {
    const conf = await import("../next.config.js" as string);
    const headers = await (conf.default ?? conf).headers();
    const v = headers[0].headers.find(
      (h: { key: string }) => h.key === "X-Frame-Options",
    )?.value;
    expect(["SAMEORIGIN", "DENY"]).toContain(v);
  });
});
