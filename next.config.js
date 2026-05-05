/** @type {import('next').NextConfig} */

// branch protection ruleset(B) 동작 확인 push.
// Next.js App Router는 hydration을 위한 inline script + Tailwind 등 inline style 사용.
// 'unsafe-inline'/'unsafe-eval'을 모두 끄면 페이지가 깨진다.
// 우리는 inline은 허용하되 폼/프레임/객체/베이스 같은 핵심 attack surface만 잠근다.
const csp = [
  "default-src 'self'",
  // hydration 인라인 + (Vercel 분석 등 차후 추가 가능)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // 이미지: 같은 출처 + Vercel Blob (https) + data:/blob: (미리보기)
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // fetch/XHR: 자기 자신 + Upbit (시세 API)
  "connect-src 'self' https://api.upbit.com",
  // 클릭재킹 방어
  "frame-ancestors 'self'",
  // base 태그 주입 차단
  "base-uri 'self'",
  // 폼 submit은 자기 자신만 — phishing redirect 방어
  "form-action 'self'",
  // <object>/<embed> 차단
  "object-src 'none'",
  "manifest-src 'self'",
].join("; ");

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
