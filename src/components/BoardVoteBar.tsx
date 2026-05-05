"use client";

import { useState, useTransition } from "react";
import { voteBoardPostAction } from "@/lib/actions";

type VoteKind = "up" | "down";

export function BoardVoteBar({
  postId,
  isAuthed,
  initialUp,
  initialDown,
  initialMy,
}: {
  postId: number;
  isAuthed: boolean;
  initialUp: number;
  initialDown: number;
  initialMy: VoteKind | null;
}) {
  const [up, setUp] = useState(initialUp);
  const [down, setDown] = useState(initialDown);
  const [my, setMy] = useState<VoteKind | null>(initialMy);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(kind: VoteKind) {
    if (!isAuthed) {
      setError("로그인이 필요합니다.");
      return;
    }
    // Optimistic
    const prev = { up, down, my };
    let nextUp = up;
    let nextDown = down;
    let nextMy: VoteKind | null = kind;
    if (my === kind) {
      // 토글 해제
      if (kind === "up") nextUp = up - 1;
      else nextDown = down - 1;
      nextMy = null;
    } else if (my === null) {
      if (kind === "up") nextUp = up + 1;
      else nextDown = down + 1;
    } else {
      // 전환
      if (kind === "up") {
        nextUp = up + 1;
        nextDown = down - 1;
      } else {
        nextUp = up - 1;
        nextDown = down + 1;
      }
    }
    setUp(Math.max(0, nextUp));
    setDown(Math.max(0, nextDown));
    setMy(nextMy);
    setError(null);

    startTransition(async () => {
      try {
        const res = await voteBoardPostAction(postId, kind);
        if (!res.ok) {
          setUp(prev.up);
          setDown(prev.down);
          setMy(prev.my);
          setError(res.error ?? "투표 실패");
          return;
        }
        // 서버 진실 값으로 동기화
        setUp(res.upvotes);
        setDown(res.downvotes);
        setMy(res.my);
      } catch {
        setUp(prev.up);
        setDown(prev.down);
        setMy(prev.my);
        setError("투표 실패");
      }
    });
  }

  const score = up - down;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handle("up")}
        disabled={!isAuthed}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm font-bold transition ${
          my === "up"
            ? "border-emerald-400 bg-emerald-400/15 text-emerald-400"
            : "border-bag-border hover:border-emerald-400 hover:text-emerald-400"
        } ${!isAuthed ? "opacity-60 cursor-not-allowed" : ""}`}
        title={isAuthed ? "추천" : "로그인 필요"}
      >
        ▲<span className="font-mono">{up}</span>
      </button>
      <span
        className={`font-mono font-black text-lg w-12 text-center ${
          score > 0 ? "text-emerald-400" : score < 0 ? "text-red-400" : "text-bag-mute"
        }`}
      >
        {score > 0 ? `+${score}` : score}
      </span>
      <button
        type="button"
        onClick={() => handle("down")}
        disabled={!isAuthed}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm font-bold transition ${
          my === "down"
            ? "border-red-400 bg-red-400/15 text-red-400"
            : "border-bag-border hover:border-red-400 hover:text-red-400"
        } ${!isAuthed ? "opacity-60 cursor-not-allowed" : ""}`}
        title={isAuthed ? "비추천" : "로그인 필요"}
      >
        ▼<span className="font-mono">{down}</span>
      </button>
      {error && (
        <span className="text-bag-accent text-[11px] ml-2">{error}</span>
      )}
    </div>
  );
}
