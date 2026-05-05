import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getUserByUsername } from "@/lib/posts";
import { listFollowing } from "@/lib/follows";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FollowingPage({
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

  const rows = await listFollowing(target.id, 200);

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
        <h1 className="text-xl font-black">팔로잉 ({rows.length})</h1>
        <p className="text-bag-mute text-sm mt-1">
          @{target.username}이(가) 지켜보는 다른 호구들.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          아직 아무도 팔로우하지 않았습니다.
        </div>
      ) : (
        <ol className="panel divide-y divide-bag-border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/u/${r.username}`}
                prefetch={false}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-bag-accent/5 transition ${
                  viewer?.id === r.id ? "bg-bag-accent/5" : ""
                }`}
              >
                <span className="font-bold flex-1 truncate">@{r.username}</span>
                <span className="text-[11px] text-bag-mute">
                  {fmtTime(r.followed_at)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
