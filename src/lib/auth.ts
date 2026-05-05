import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { dbBatch, dbGet, dbRun, type UserRow } from "./db";

const COOKIE_NAME = "bag_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export const PASSWORD_MAX = 128;

// 콜드 스타트 시 1회 계산되는 더미 해시. 사용자 부재 시 timing 차이를
// 줄이기 위해 항상 같은 형태의 bcrypt.compare를 수행하는 데 사용.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  // bcrypt.compare는 hash가 비정상이면 false 반환. 일관된 비용 보장 위해 더미 사용.
  return bcrypt.compare(plain, hash || DUMMY_HASH);
}

// timing-safe verification: 사용자 미존재여도 항상 bcrypt 1회 실행.
export async function verifyPasswordTimingSafe(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  const result = await bcrypt.compare(plain, hash || DUMMY_HASH);
  // hash가 없으면 결과를 강제로 false (실수로 더미와 일치하는 plain 방어).
  return !!hash && result;
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  await dbRun(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    [token, userId, now, expiresAt],
  );
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await dbRun("DELETE FROM sessions WHERE token = ?", [token]);
}

export async function setSessionCookie(token: string, expiresAt: number) {
  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export const getCurrentUser = cache(async (): Promise<UserRow | null> => {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const row = await dbGet<UserRow>(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    [token, Date.now()],
  );
  return row ?? null;
});

export async function getSessionToken() {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value;
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_가-힣]{2,16}$/;

// 회원 탈퇴: 비밀번호 검증 후 사용자 본인 계정과 관련 데이터를 일괄 삭제.
// libSQL은 기본적으로 외래키를 enforce하지 않으므로 명시적으로 cascading 처리.
// 갤러리 글/댓글은 익명 처리(user_id=NULL)해서 다른 이용자 토론 흐름은 보존.
export async function withdrawAccount(
  userId: number,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const u = await dbGet<UserRow>("SELECT * FROM users WHERE id = ?", [userId]);
  if (!u) return { ok: false, error: "사용자가 없습니다." };
  const ok = await verifyPassword(password, u.password_hash);
  if (!ok) return { ok: false, error: "비밀번호가 일치하지 않습니다." };

  await dbBatch([
    { sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] },
    {
      sql: "DELETE FROM reactions WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)",
      args: [userId],
    },
    {
      sql: "DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)",
      args: [userId],
    },
    { sql: "DELETE FROM reactions WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM comments WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM follows WHERE follower_id = ?", args: [userId] },
    { sql: "DELETE FROM follows WHERE following_id = ?", args: [userId] },
    { sql: "DELETE FROM coin_favorites WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM guestbook_entries WHERE owner_id = ?", args: [userId] },
    { sql: "DELETE FROM guestbook_entries WHERE author_id = ?", args: [userId] },
    { sql: "DELETE FROM posts WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM board_votes WHERE user_id = ?", args: [userId] },
    // 갤러리 글/댓글은 다른 이용자와의 흐름이 있으니 익명 처리.
    { sql: "UPDATE board_posts SET user_id = NULL WHERE user_id = ?", args: [userId] },
    { sql: "UPDATE board_comments SET user_id = NULL WHERE user_id = ?", args: [userId] },
    { sql: "DELETE FROM users WHERE id = ?", args: [userId] },
  ]);

  return { ok: true };
}
