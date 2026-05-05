// Rate limit — 분산 환경(Upstash Redis)이 있으면 그걸 쓰고, 없으면 인메모리 폴백.
// 기본은 in-memory (Vercel 인스턴스 단위). 분산이 필요하면
// Upstash KV를 Vercel Marketplace에서 추가하면 자동 감지.

import { Redis } from "@upstash/redis";

const KV_URL =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const KV_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const redis: Redis | null =
  KV_URL && KV_TOKEN ? new Redis({ url: KV_URL, token: KV_TOKEN }) : null;

// ─── 인메모리 fallback ──────────────────────────────────────────

type Attempt = { count: number; lockedUntil: number };

declare global {
  // eslint-disable-next-line no-var
  var __bagAttempts: Map<string, Attempt> | undefined;
}

const memStore: Map<string, Attempt> =
  globalThis.__bagAttempts ?? (globalThis.__bagAttempts = new Map());

// ─── 옵션 ──────────────────────────────────────────────────────

export type RateLimitOpts = {
  max: number;
  windowMs: number;
  lockMs: number;
};

export const LOGIN_OPTS: RateLimitOpts = {
  max: 5,
  windowMs: 15 * 60 * 1000,
  lockMs: 5 * 60 * 1000,
};

export const REPORT_OPTS: RateLimitOpts = {
  max: 10,
  windowMs: 60 * 60 * 1000,
  lockMs: 60 * 60 * 1000,
};

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

// ─── 공개 API (모두 async — Redis fallback 호환) ────────────────

export async function checkLocked(
  key: string,
  opts: RateLimitOpts = LOGIN_OPTS,
): Promise<number | null> {
  if (redis) {
    try {
      const ttl = await redis.ttl(`rl:lock:${key}`);
      return ttl > 0 ? ttl : null;
    } catch (e) {
      console.warn("[rate-limit] redis ttl failed, fallback:", e);
    }
  }
  return memCheckLocked(key, opts);
}

export async function recordFailure(
  key: string,
  opts: RateLimitOpts = LOGIN_OPTS,
): Promise<{ lockedFor: number | null }> {
  if (redis) {
    try {
      const failKey = `rl:fail:${key}`;
      const count = await redis.incr(failKey);
      if (count === 1) {
        await redis.expire(failKey, Math.ceil(opts.windowMs / 1000));
      }
      if (count >= opts.max) {
        const lockSec = Math.ceil(opts.lockMs / 1000);
        await redis.set(`rl:lock:${key}`, "1", { ex: lockSec });
        await redis.del(failKey);
        return { lockedFor: lockSec };
      }
      return { lockedFor: null };
    } catch (e) {
      console.warn("[rate-limit] redis incr failed, fallback:", e);
    }
  }
  return memRecordFailure(key, opts);
}

export async function recordSuccess(key: string): Promise<void> {
  if (redis) {
    try {
      await Promise.all([
        redis.del(`rl:fail:${key}`),
        redis.del(`rl:lock:${key}`),
      ]);
      return;
    } catch (e) {
      console.warn("[rate-limit] redis del failed, fallback:", e);
    }
  }
  memStore.delete(key);
}

// 신고 등 "성공도 카운트하는 hit" — 동일 동작 (실패 카운터 사용).
export async function recordHit(
  key: string,
  opts: RateLimitOpts,
): Promise<{ lockedFor: number | null }> {
  return recordFailure(key, opts);
}

// ─── 인메모리 구현 ─────────────────────────────────────────────

function memCheckLocked(key: string, opts: RateLimitOpts): number | null {
  const a = memStore.get(key);
  if (!a) return null;
  const now = Date.now();
  if (a.lockedUntil > now) return Math.ceil((a.lockedUntil - now) / 1000);
  if (now > a.lockedUntil + opts.windowMs) memStore.delete(key);
  return null;
}

function memRecordFailure(
  key: string,
  opts: RateLimitOpts,
): { lockedFor: number | null } {
  const now = Date.now();
  const a = memStore.get(key) ?? { count: 0, lockedUntil: 0 };
  a.count += 1;
  if (a.count >= opts.max) {
    a.lockedUntil = now + opts.lockMs;
    a.count = 0;
    memStore.set(key, a);
    return { lockedFor: Math.ceil(opts.lockMs / 1000) };
  }
  memStore.set(key, a);
  return { lockedFor: null };
}
