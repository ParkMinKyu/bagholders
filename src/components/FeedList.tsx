"use client";

import { useState, useTransition } from "react";
import type { FeedPost } from "@/lib/posts";
import { loadMoreFeedAction } from "@/lib/actions";
import { FEED_PAGE_SIZE } from "@/lib/feed-config";
import { PostCard } from "./PostCard";

export function FeedList({
  initial,
  isAuthed,
  isAdmin = false,
}: {
  initial: FeedPost[];
  isAuthed: boolean;
  isAdmin?: boolean;
}) {
  const [posts, setPosts] = useState<FeedPost[]>(initial);
  // 첫 로드가 page size보다 작으면 더 이상 없음.
  const [done, setDone] = useState(initial.length < FEED_PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    if (pending || done) return;
    const last = posts[posts.length - 1];
    if (!last) {
      setDone(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const more = await loadMoreFeedAction(Number(last.created_at));
        if (more.length === 0) {
          setDone(true);
          return;
        }
        // 중복 방지 (이론상 없지만 안전장치).
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const fresh = more.filter((p) => !ids.has(p.id));
          return [...prev, ...fresh];
        });
        if (more.length < FEED_PAGE_SIZE) setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "로드 실패");
      }
    });
  }

  if (posts.length === 0) {
    return (
      <div className="panel p-8 text-center text-bag-mute text-sm">
        아직 인증된 손실이 없습니다. 첫 번째 고점 판독기가 되어보세요.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} isAuthed={isAuthed} isAdmin={isAdmin} />
        ))}
      </div>

      {error && (
        <p className="text-bag-accent text-xs text-center mt-2">{error}</p>
      )}

      {!done ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={pending}
          className="btn w-full mt-3"
        >
          {pending ? "로드 중…" : "더보기"}
        </button>
      ) : (
        <div className="text-center text-bag-mute text-xs py-4 mt-2">
          — 끝 —
        </div>
      )}
    </>
  );
}
