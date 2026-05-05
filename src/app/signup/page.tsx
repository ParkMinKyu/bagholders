import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="max-w-sm mx-auto panel p-6 mt-10">
      <h1 className="text-xl font-black mb-1">고점 판독기 등록</h1>
      <p className="text-bag-mute text-sm mb-4">
        손실 인증할 닉네임을 만드세요. 통장 잔고는 묻지 않습니다.
      </p>
      {sp.error && (
        <div className="text-bag-accent text-sm mb-3 border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}
      <form method="post" action="/api/auth/signup" className="space-y-3">
        <div>
          <label className="text-xs text-bag-mute">닉네임 (2~16자)</label>
          <input className="input mt-1" name="username" required maxLength={16} autoComplete="username" />
        </div>
        <div>
          <label className="text-xs text-bag-mute">비밀번호 (8~128자)</label>
          <input
            className="input mt-1"
            type="password"
            name="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
        </div>

        <div className="rounded-md border border-bag-border bg-black/20 p-3 space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="agree_terms"
              required
              className="accent-bag-accent mt-0.5"
            />
            <span>
              <Link
                href="/terms"
                target="_blank"
                rel="noopener"
                className="underline hover:text-bag-accent"
              >
                이용약관
              </Link>
              에 동의합니다 (필수)
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="agree_privacy"
              required
              className="accent-bag-accent mt-0.5"
            />
            <span>
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener"
                className="underline hover:text-bag-accent"
              >
                개인정보처리방침
              </Link>
              에 동의합니다 (필수)
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="age_ok"
              required
              className="accent-bag-accent mt-0.5"
            />
            <span>만 14세 이상입니다 (필수)</span>
          </label>
        </div>

        <button className="btn-primary w-full" type="submit">
          가입하고 손실 인증하러 가기
        </button>
      </form>
      <p className="text-xs text-bag-mute mt-4">
        이미 계정이 있다면? <Link href="/login" className="text-white underline">로그인</Link>
      </p>
    </div>
  );
}
