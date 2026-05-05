import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { dbGet, dbRun } from "./db";

// ─── 환경 ──────────────────────────────────────────────────────

export function adminEmailAllowed(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS;
  const list = (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const target = email.trim().toLowerCase();
  const matched = list.includes(target);

  // 진단용: env가 있는지 / 길이 / 매칭 여부만. 값 자체는 노출 안 함.
  if (!matched) {
    console.log(
      "[debug/admin-allowed]",
      JSON.stringify({
        envDefined: raw !== undefined,
        envLen: raw?.length ?? 0,
        listCount: list.length,
        targetLen: target.length,
        // 보안상 첫·마지막 글자만 (눈으로 일치 확인용)
        targetSig: target ? `${target[0]}…${target[target.length - 1]}` : "",
        listSigs: list.map((e) => `${e[0]}…${e[e.length - 1]}`),
      }),
    );
  }

  if (list.length === 0) return false;
  return matched;
}

// ─── 인증 코드 ─────────────────────────────────────────────────

const CODE_TTL_MIN = 5;
export const CODE_TTL_MS = CODE_TTL_MIN * 60 * 1000;
export const CODE_TTL_LABEL = `${CODE_TTL_MIN}분`;
const CODE_MAX_ATTEMPTS = 5;

export function generateCode(): string {
  // 6자리 숫자 코드 (앞자리 0 가능).
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export async function createLoginCode(email: string): Promise<string> {
  const code = generateCode();
  const hash = await bcrypt.hash(code, 6);
  const now = Date.now();
  // 같은 이메일에 대해 기존 코드는 덮어씀.
  await dbRun(
    `INSERT INTO admin_login_codes (email, code_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       created_at = excluded.created_at`,
    [email.toLowerCase(), hash, now + CODE_TTL_MS, now],
  );
  return code;
}

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many" | "wrong" };

export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<VerifyCodeResult> {
  const row = await dbGet<{
    code_hash: string;
    expires_at: number;
    attempts: number;
  }>(
    "SELECT code_hash, expires_at, attempts FROM admin_login_codes WHERE email = ?",
    [email.toLowerCase()],
  );
  if (!row) return { ok: false, reason: "no_code" };
  const now = Date.now();
  if (Number(row.expires_at) < now) {
    await dbRun("DELETE FROM admin_login_codes WHERE email = ?", [
      email.toLowerCase(),
    ]);
    return { ok: false, reason: "expired" };
  }
  if (Number(row.attempts) >= CODE_MAX_ATTEMPTS) {
    return { ok: false, reason: "too_many" };
  }
  const ok = await bcrypt.compare(code, row.code_hash);
  if (!ok) {
    await dbRun(
      "UPDATE admin_login_codes SET attempts = attempts + 1 WHERE email = ?",
      [email.toLowerCase()],
    );
    return { ok: false, reason: "wrong" };
  }
  // 성공 시 코드 폐기 (1회용).
  await dbRun("DELETE FROM admin_login_codes WHERE email = ?", [
    email.toLowerCase(),
  ]);
  return { ok: true };
}

// ─── 관리자 세션 ───────────────────────────────────────────────

const ADMIN_COOKIE = "bag_admin_session";
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24시간 (일반 세션보다 짧게)

export type AdminSession = { email: string };

export async function createAdminSession(
  email: string,
): Promise<{ token: string; expiresAt: number }> {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + ADMIN_SESSION_TTL_MS;
  await dbRun(
    "INSERT INTO admin_sessions (token, email, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [token, email.toLowerCase(), expiresAt, now],
  );
  return { token, expiresAt };
}

export async function destroyAdminSession(token: string): Promise<void> {
  await dbRun("DELETE FROM admin_sessions WHERE token = ?", [token]);
}

export async function setAdminSessionCookie(
  token: string,
  expiresAt: number,
): Promise<void> {
  const c = await cookies();
  c.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}

export async function getAdminSessionToken(): Promise<string | undefined> {
  const c = await cookies();
  return c.get(ADMIN_COOKIE)?.value;
}

export const getCurrentAdmin = cache(
  async (): Promise<AdminSession | null> => {
    const c = await cookies();
    const token = c.get(ADMIN_COOKIE)?.value;
    if (!token) return null;
    const row = await dbGet<{ email: string; expires_at: number }>(
      "SELECT email, expires_at FROM admin_sessions WHERE token = ? AND expires_at > ?",
      [token, Date.now()],
    );
    if (!row) return null;
    // 유효해도 환경변수에서 빠지면 즉시 권한 박탈.
    if (!adminEmailAllowed(row.email)) return null;
    return { email: row.email };
  },
);
