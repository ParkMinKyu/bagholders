import { cache } from "react";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { dbGet, dbRun, type UserRow } from "./db";

const COOKIE_NAME = "bag_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
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
