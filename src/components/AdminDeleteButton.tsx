"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminDeleteBoardCommentAction,
  adminDeleteBoardPostAction,
  adminDeleteCommentAction,
  adminDeleteGuestbookEntryAction,
  adminDeletePostAction,
} from "@/lib/admin-actions";

type Target =
  | "post"
  | "board_post"
  | "comment"
  | "board_comment"
  | "guestbook";

export function AdminDeleteButton({
  targetType,
  targetId,
  label = "관리자 삭제",
}: {
  targetType: Target;
  targetId: number;
  label?: string;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handle() {
    if (!confirm("정말 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    setError(null);
    startTransition(async () => {
      let r;
      switch (targetType) {
        case "post":
          r = await adminDeletePostAction(targetId);
          break;
        case "board_post":
          r = await adminDeleteBoardPostAction(targetId);
          break;
        case "comment":
          r = await adminDeleteCommentAction(targetId);
          break;
        case "board_comment":
          r = await adminDeleteBoardCommentAction(targetId);
          break;
        case "guestbook":
          r = await adminDeleteGuestbookEntryAction(targetId);
          break;
      }
      if (!r.ok) {
        setError(r.error ?? "삭제 실패");
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return <span className="text-[11px] text-bag-mute">삭제됨</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        title={label}
        className="text-[11px] font-bold text-bag-accent border border-bag-accent/40 rounded px-1.5 py-0.5 hover:bg-bag-accent/10 transition"
      >
        🛡 {pending ? "삭제 중…" : label}
      </button>
      {error && <span className="text-[11px] text-bag-accent">{error}</span>}
    </span>
  );
}
