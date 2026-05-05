import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPostById } from "@/lib/posts";
import { listComments } from "@/lib/comments";
import { PostCard } from "@/components/PostCard";
import { CommentForm } from "@/components/CommentForm";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const postId = Number(rawId);
  if (!Number.isFinite(postId)) notFound();

  const viewer = await getCurrentUser();
  const [post, comments] = await Promise.all([
    getPostById(postId, viewer?.id ?? null),
    listComments(postId, 200),
  ]);

  if (!post) notFound();

  return (
    <div className="space-y-4">
      <div className="text-xs text-bag-mute px-1">
        <Link href="/" prefetch={false} className="hover:text-bag-accent">
          ← 피드로
        </Link>
      </div>

      <PostCard post={post} isAuthed={!!viewer} />

      <section className="panel p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider">
            💬 댓글 ({comments.length})
          </h2>
        </div>

        {viewer ? (
          <CommentForm postId={post.id} />
        ) : (
          <div className="text-xs text-bag-mute">
            <Link href="/login" prefetch={false} className="text-bag-accent hover:underline">
              로그인
            </Link>
            {" "}하면 댓글을 남길 수 있어요.
          </div>
        )}

        {comments.length > 0 && (
          <ol className="divide-y divide-bag-border -mx-4 mt-2">
            {comments.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <Link
                    href={`/u/${c.username}`}
                    prefetch={false}
                    className="font-bold text-sm hover:text-bag-accent"
                  >
                    @{c.username}
                  </Link>
                  <span className="text-[11px] text-bag-mute">
                    {fmtTime(c.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed mt-1">
                  {c.body}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
