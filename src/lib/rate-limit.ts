// 인메모리 rate limit (Vercel 서버리스 인스턴스 단위. 완벽한 분산 잠금 아님.
// KV/Redis 도입 전까지 기본 방어선).

type Attempt = { count: number; lockedUntil: number };

declare global {
  // eslint-disable-next-line no-var
  var __bagAttempts: Map<string, Attempt> | undefined;
}

const store: Map<string, Attempt> =
  globalThis.__bagAttempts ?? (globalThis.__bagAttempts = new Map());

const WINDOW_MS = 15 * 60 * 1000; // 15분 윈도우
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000; // 5분 잠금

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

// 잠겨있으면 남은 초 반환, 아니면 null.
export function checkLocked(key: string): number | null {
  const a = store.get(key);
  if (!a) return null;
  const now = Date.now();
  if (a.lockedUntil > now) {
    return Math.ceil((a.lockedUntil - now) / 1000);
  }
  // 윈도우 만료된 항목 정리
  if (now > a.lockedUntil + WINDOW_MS) {
    store.delete(key);
  }
  return null;
}

export function recordFailure(key: string): { lockedFor: number | null } {
  const now = Date.now();
  const a = store.get(key) ?? { count: 0, lockedUntil: 0 };
  a.count += 1;
  if (a.count >= MAX_FAILS) {
    a.lockedUntil = now + LOCK_MS;
    a.count = 0;
    store.set(key, a);
    return { lockedFor: Math.ceil(LOCK_MS / 1000) };
  }
  store.set(key, a);
  return { lockedFor: null };
}

export function recordSuccess(key: string): void {
  store.delete(key);
}
