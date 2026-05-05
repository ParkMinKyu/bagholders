import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listFavorites } from "@/lib/favorites";
import { CoinSearchPicker } from "@/components/CoinSearchPicker";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; kind?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const initialKind = sp.kind === "sell_low" ? "sell_low" : "buy_high";
  const favs = await listFavorites(user.id, 30);
  const favoriteCoins = favs.map((f) => ({
    id: f.ticker_code,
    symbol: f.ticker_symbol,
    name: f.ticker_name,
  }));

  return (
    <div className="max-w-xl mx-auto panel p-6">
      <h1 className="text-xl font-black mb-1">📉 인증 작성</h1>
      <p className="text-bag-mute text-sm mb-4">
        실시간 시세와 비교돼 손실률이 자동 계산됩니다. 5분마다 갱신.
      </p>
      {sp.error && (
        <div className="text-bag-accent text-sm mb-3 border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}
      <form method="post" action="/api/posts/create">
        <CoinSearchPicker initialKind={initialKind} favorites={favoriteCoins} />
      </form>
    </div>
  );
}
