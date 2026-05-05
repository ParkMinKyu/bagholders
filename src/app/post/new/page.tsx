import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/posts";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;

  return (
    <div className="max-w-xl mx-auto panel p-6">
      <h1 className="text-xl font-black mb-1">📉 손실 인증 작성</h1>
      <p className="text-bag-mute text-sm mb-4">
        가격은 직접 입력합니다. 시세 검증 안 하니 부풀려도 친구들이 알아챕니다.
      </p>
      {sp.error && (
        <div className="text-bag-accent text-sm mb-3 border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}
      <form method="post" action="/api/posts/create" className="space-y-3">
        <div>
          <label className="text-xs text-bag-mute">카테고리</label>
          <div className="mt-1 grid grid-cols-4 gap-2">
            {CATEGORIES.map((c, i) => (
              <label
                key={c}
                className="flex items-center justify-center cursor-pointer border border-bag-border rounded-md py-2 text-sm has-[:checked]:border-bag-accent has-[:checked]:bg-bag-accent/10 has-[:checked]:text-bag-accent"
              >
                <input
                  type="radio"
                  name="category"
                  value={c}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                {c}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-bag-mute">종목명 또는 코인명</label>
          <input
            className="input mt-1"
            name="ticker"
            required
            maxLength={40}
            placeholder="예: 삼성전자, 비트코인, 두산에너빌리티"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-bag-mute">매수가</label>
            <input
              className="input mt-1"
              name="buy_price"
              type="number"
              step="any"
              min="0"
              required
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-bag-mute">현재가 (또는 매도가)</label>
            <input
              className="input mt-1"
              name="current_price"
              type="number"
              step="any"
              min="0"
              required
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-bag-mute">수량 (선택)</label>
          <input
            className="input mt-1"
            name="quantity"
            type="number"
            step="any"
            min="0"
            placeholder="비워두면 손실액 계산 안 함"
          />
        </div>
        <div>
          <label className="text-xs text-bag-mute">한줄평 (선택)</label>
          <textarea
            className="input mt-1"
            name="comment"
            rows={3}
            maxLength={500}
            placeholder="예: 어제 사면 됐는데 오늘 사버림. 이게 나야."
          />
        </div>
        <button className="btn-primary w-full" type="submit">
          공개 망신 등록하기
        </button>
      </form>
    </div>
  );
}
