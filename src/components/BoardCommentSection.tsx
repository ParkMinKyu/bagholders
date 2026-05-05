"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addBoardCommentAction, type BoardCommentDTO } from "@/lib/actions";
import { fmtTime } from "@/lib/format";

const COMMENT_MAX = 500;
const NICK_MAX = 16;

export function BoardCommentSection({
  postId,
  isAuthed,
  initial,
}: {
  postId: number;
  isAuthed: boolean;
  initial: BoardCommentDTO[];
}) {
  const [comments, setComments] = useState<BoardCommentDTO[]>(initial);
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [anonNickname, setAnonNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    setError(null);
    const nick = anon ? (anonNickname.trim() || "ㅇㅇ").slice(0, NICK_MAX) : null;
    startTransition(async () => {
      const res = await addBoardCommentAction(postId, trimmed, nick);
      if (!res.ok) {
        setError(res.error ?? "등록 실패");
        return;
      }
      setComments((prev) => [...prev, res.comment]);
      setBody("");
    });
  }

  return (
    <section className="panel p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider">
          💬 댓글 ({comments.length})
        </h2>
      </div>

      {isAuthed ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={COMMENT_MAX}
            placeholder="댓글을 남겨보세요"
            className="input"
            disabled={pending}
          />
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={anon}
                onChange={(e) => setAnon(e.target.checked)}
                className="accent-bag-accent"
              />
              <span>익명</span>
              {anon && (
                <input
                  value={anonNickname}
                  onChange={(e) => setAnonNickname(e.target.value)}
                  maxLength={NICK_MAX}
                  placeholder="ㅇㅇ"
                  className="input !py-0.5 !px-2 text-[11px] w-24"
                />
              )}
            </label>
            <div className="flex items-center gap-2">
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
          </div>
          {error && <p className="text-bag-accent text-xs">{error}</p>}
        </form>
      ) : (
        <div className="text-xs text-bag-mute">
          <Link href="/login" prefetch={false} className="text-bag-accent hover:underline">
            로그인
          </Link>
          {" "}하면 댓글을 남길 수 있어요.
        </div>
      )}

      {comments.length > 0 && (
        <ol className="divide-y divide-bag-border -mx-4">
          {comments.map((c) => (
            <li key={c.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between">
                <span
                  className={`font-bold text-sm ${
                    c.is_anon ? "text-bag-mute" : "text-white"
                  }`}
                >
                  {c.is_anon ? c.display_name : `@${c.display_name}`}
                </span>
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
  );
}
