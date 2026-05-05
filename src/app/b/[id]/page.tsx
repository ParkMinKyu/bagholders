import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getBoardPost,
  getMyBoardVote,
  listBoardComments,
} from "@/lib/board";
import { categoryLabel } from "@/lib/board-config";
import { BoardVoteBar } from "@/components/BoardVoteBar";
import { BoardCommentSection } from "@/components/BoardCommentSection";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BoardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const postId = Number(rawId);
  if (!Number.isFinite(postId)) notFound();

  const viewer = await getCurrentUser();
  const [post, comments, myVote] = await Promise.all([
    getBoardPost(postId),
    listBoardComments(postId, 200),
    viewer ? getMyBoardVote(postId, viewer.id) : Promise.resolve(null),
  ]);

  if (!post) notFound();

  return (
    <div className="space-y-4">
      <div className="text-xs text-bag-mute px-1">
        <Link href="/b" prefetch={false} className="hover:text-bag-accent">
          ← 갤러리
        </Link>
      </div>

      <article className="panel p-5 space-y-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link
            href={`/b?category=${post.category}`}
            prefetch={false}
            className="text-[11px] text-bag-mute border border-bag-border rounded px-1.5 py-0.5 hover:border-bag-accent hover:text-bag-accent"
          >
            [{categoryLabel(post.category)}]
          </Link>
          <h1 className="text-xl font-black flex-1 min-w-0 break-words">
            {post.title}
          </h1>
        </div>

        <div className="flex items-baseline gap-2 text-xs text-bag-mute">
          {post.is_anon ? (
            <span className="font-bold">{post.display_name}</span>
          ) : (
            <Link
              href={`/u/${post.display_name}`}
              prefetch={false}
              className="font-bold hover:text-bag-accent"
            >
              @{post.display_name}
            </Link>
          )}
          <span>·</span>
          <span>{fmtTime(post.created_at)}</span>
          {post.is_anon && (
            <span className="ml-auto text-[10px] opacity-60">익명</span>
          )}
        </div>

        <div className="text-sm whitespace-pre-wrap leading-relaxed pt-2">
          {post.body}
        </div>

        {post.image_url && (
          <a
            href={post.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md overflow-hidden border border-bag-border bg-black/20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image_url}
              alt="첨부 이미지"
              loading="lazy"
              className="mx-auto max-h-96 max-w-full object-contain"
            />
          </a>
        )}

        <div className="pt-3 border-t border-bag-border flex justify-center">
          <BoardVoteBar
            postId={post.id}
            isAuthed={!!viewer}
            initialUp={post.upvotes}
            initialDown={post.downvotes}
            initialMy={myVote}
          />
        </div>
      </article>

      <BoardCommentSection
        postId={post.id}
        isAuthed={!!viewer}
        initial={comments.map((c) => ({
          id: c.id,
          display_name: c.display_name,
          is_anon: c.is_anon,
          body: c.body,
          created_at: c.created_at,
        }))}
      />
    </div>
  );
}
