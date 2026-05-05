"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCommentAction } from "@/lib/actions";

const COMMENT_MAX = 500;

export function CommentForm({ postId }: { postId: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await addCommentAction(postId, trimmed);
      if (!res.ok) {
        setError(res.error ?? "등록 실패");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={COMMENT_MAX}
        placeholder="댓글을 남겨보세요. (최대 500자)"
        className="input"
        disabled={pending}
      />
      <div className="flex items-center gap-2 justify-between">
        <span className="text-[11px] text-bag-mute">
          {body.length}/{COMMENT_MAX}
        </span>
        <button
          type="submit"
          disabled={!body.trim() || pending}
          className="btn-primary !py-1 !px-3 text-xs"
        >
          {pending ? "등록 중…" : "댓글 등록"}
        </button>
      </div>
      {error && <p className="text-bag-accent text-xs">{error}</p>}
    </form>
  );
}
