"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, applyOptimistic] = useOptimistic<State, string>(
    { counts: initialCounts, mine: initialMine },
    (prev, kind) => {
      const isMine = prev.mine.includes(kind);
      const delta = isMine ? -1 : 1;
      return {
        counts: {
          ...prev.counts,
          [kind]: Math.max(0, (prev.counts[kind] ?? 0) + delta),
        },
        mine: isMine ? prev.mine.filter((k) => k !== kind) : [...prev.mine, kind],
      };
    },
  );

  function handle(kind: string) {
    if (!isAuthed) return;
    startTransition(async () => {
      applyOptimistic(kind);
      await toggleReactionAction(postId, kind);
      // 액션이 성공해도 부모(RSC) props를 새로 받아야 useOptimistic이
      // 갱신된 카운트를 기준으로 삼음. 안 부르면 transition 종료 시
      // 이전 props 값(카운트 0)으로 되돌아가 "1 → 0"으로 깜빡임.
      router.refresh();
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
