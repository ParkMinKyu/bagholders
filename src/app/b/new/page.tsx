import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BoardWriter } from "@/components/BoardWriter";
import {
  BOARD_CATEGORIES,
  type BoardCategoryKey,
} from "@/lib/board-config";

export default async function NewBoardPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const initialCategory: BoardCategoryKey = BOARD_CATEGORIES.some(
    (c) => c.key === sp.category,
  )
    ? (sp.category as BoardCategoryKey)
    : "free";

  return (
    <div className="max-w-2xl mx-auto panel p-6">
      <h1 className="text-xl font-black mb-1">✏️ 새 글</h1>
      <p className="text-bag-mute text-sm mb-4">자유 게시판에 글을 남깁니다.</p>
      {sp.error && (
        <div className="text-bag-accent text-sm mb-3 border border-bag-accent/40 bg-red-500/10 rounded p-2">
          {sp.error}
        </div>
      )}
      <form
        method="post"
        action="/api/board/create"
        encType="multipart/form-data"
      >
        <BoardWriter initialCategory={initialCategory} />
      </form>
    </div>
  );
}
