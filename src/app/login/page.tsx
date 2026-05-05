import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="max-w-sm mx-auto panel p-6 mt-10">
      <h1 className="text-xl font-black mb-1">다시 손실 인증하러 오셨군요</h1>
      <p className="text-bag-mute text-sm mb-4">
        이번엔 어디 종목인가요? 미리 삼가 고인의 명복을.
      </p>
      {sp.error && (
        <div className="text-bag-accent text-sm mb-3 border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}
      <form method="post" action="/api/auth/login" className="space-y-3">
        <div>
          <label className="text-xs text-bag-mute">닉네임</label>
          <input className="input mt-1" name="username" required autoComplete="username" />
        </div>
        <div>
          <label className="text-xs text-bag-mute">비밀번호</label>
          <input
            className="input mt-1"
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </div>
        <button className="btn-primary w-full" type="submit">로그인</button>
      </form>
      <p className="text-xs text-bag-mute mt-4">
        처음이신가요? <Link href="/signup" className="text-white underline">회원가입</Link>
      </p>
    </div>
  );
}
