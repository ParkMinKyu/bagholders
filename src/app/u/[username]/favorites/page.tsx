import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserByUsername } from "@/lib/posts";
import { listFavorites } from "@/lib/favorites";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [target, viewer] = await Promise.all([
    getUserByUsername(decodeURIComponent(username)),
    getCurrentUser(),
  ]);
  if (!target) notFound();

  const rows = await listFavorites(target.id, 200);
  const isSelf = !!viewer && viewer.id === target.id;

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="text-xs text-bag-mute mb-1">
          <Link
            href={`/u/${target.username}`}
            prefetch={false}
            className="hover:text-bag-accent"
          >
            ← @{target.username}
          </Link>
        </div>
        <h1 className="text-xl font-black">★ 즐겨찾기 ({rows.length})</h1>
        <p className="text-bag-mute text-sm mt-1">
          {isSelf
            ? "당신이 지켜보는 코인들. 관망 리스트인가, 다음 쪽팔림인가."
            : `@${target.username}이(가) 지켜보는 코인.`}
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          아직 즐겨찾기한 코인이 없습니다.
        </div>
      ) : (
        <ol className="panel divide-y divide-bag-border">
          {rows.map((c) => (
            <li key={c.ticker_code}>
              <Link
                href={`/t/${encodeURIComponent(c.ticker_code)}`}
                prefetch={false}
                className="flex items-center gap-3 px-4 py-3 hover:bg-bag-accent/5 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">
                    {c.ticker_name}
                    <span className="ml-2 text-xs text-bag-mute font-mono">
                      {c.ticker_symbol}
                    </span>
                  </div>
                  <div className="text-[11px] text-bag-mute mt-0.5">
                    {fmtTime(c.created_at)} 추가
                  </div>
                </div>
                <span className="text-bag-gold text-lg">★</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
