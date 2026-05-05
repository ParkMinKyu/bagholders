"use client";

import { useState, useTransition } from "react";
import { REACTIONS } from "@/lib/post-kinds";
import { toggleReactionAction } from "@/lib/actions";

type State = {
  counts: Record<string, number>;
  mine: string[];
};

export function ReactionsRow({
  postId,
  isAuthed,
  initialCounts,
  initialMine,
}: {
  postId: number;
  isAuthed: boolean;
  initialCounts: Record<string, number>;
  initialMine: string[];
}) {
  const [, startTransition] = useTransition();
  // FeedList가 클라 state로 posts를 들고 있어 router.refresh()로 RSC를 다시 받아도
  // 이 컴포넌트의 props는 갱신 안 됨. 그래서 useOptimistic 대신 plain useState로
  // 클라 측 진실의 원천을 유지. 서버 액션이 거절하면 롤백.
  const [state, setState] = useState<State>({
    counts: initialCounts,
    mine: initialMine,
  });

  function handle(kind: string) {
    if (!isAuthed) return;
    const wasMine = state.mine.includes(kind);
    const delta = wasMine ? -1 : 1;
    const next: State = {
      counts: {
        ...state.counts,
        [kind]: Math.max(0, (state.counts[kind] ?? 0) + delta),
      },
      mine: wasMine ? state.mine.filter((k) => k !== kind) : [...state.mine, kind],
    };
    const prev = state;
    setState(next);

    startTransition(async () => {
      try {
        const res = await toggleReactionAction(postId, kind);
        if (!res.ok) setState(prev); // 미인증 등 거절 시 롤백
      } catch {
        setState(prev);
      }
    });
  }

  return (
    <footer className="flex flex-wrap gap-2 pt-2 border-t border-bag-border">
      {REACTIONS.map((r) => {
        const count = state.counts[r.kind] ?? 0;
        const mine = state.mine.includes(r.kind);
        return (
          <button
            key={r.kind}
            type="button"
            disabled={!isAuthed}
            onClick={() => handle(r.kind)}
            title={isAuthed ? r.label : "로그인 후 누를 수 있습니다"}
            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition ${
              mine
                ? "border-bag-accent bg-bag-accent/15 text-bag-accent"
                : "border-bag-border hover:border-bag-accent hover:text-bag-accent"
            } ${!isAuthed ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <span>{r.emoji}</span>
            <span>{r.label}</span>
            {count > 0 && <span className="font-mono">{count}</span>}
          </button>
        );
      })}
    </footer>
  );
}
