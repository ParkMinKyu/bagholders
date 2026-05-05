import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db, type UserRow } from "./db";

const COOKIE_NAME = "bag_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).run(token, userId, now, expiresAt);
  return { token, expiresAt };
}

export function destroySession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
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

export async function getCurrentUser(): Promise<UserRow | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as UserRow | undefined;
  return row ?? null;
}

export async function getSessionToken() {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value;
}

export const USERNAME_REGEX = /^[a-zA-Z0-9_가-힣]{2,16}$/;
