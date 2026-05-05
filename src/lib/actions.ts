"use server";

import { getCurrentUser } from "./auth";
import {
  addBoardComment,
  voteBoardPost,
  type VoteKind,
} from "./board";
import { addComment } from "./comments";
import { dbGet, dbRun } from "./db";
import { addGuestbookEntry } from "./guestbook";
import { listFeed, type FeedPost } from "./posts";
import { REACTIONS } from "./post-kinds";
import {
  createReport,
  REPORT_REASONS,
  REPORT_TARGETS,
  type ReportReason,
  type ReportTarget,
} from "./reports";

export type ReactionToggleResult = {
  ok: boolean;
  // 서버 기준 상태 — 클라가 optimistic을 못 맞춘 경우 보정에 사용 가능.
  active: boolean;
};

export async function toggleReactionAction(
  postId: number,
  kind: string,
): Promise<ReactionToggleResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, active: false };

  const valid = REACTIONS.some((r) => r.kind === kind);
  if (!valid || !Number.isFinite(postId)) return { ok: false, active: false };

  const exists = await dbGet<{ id: number }>(
    "SELECT id FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ?",
    [postId, user.id, kind],
  );

  if (exists) {
    await dbRun(
      "DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND kind = ?",
      [postId, user.id, kind],
    );
    return { ok: true, active: false };
  }

  await dbRun(
    "INSERT INTO reactions (post_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)",
    [postId, user.id, kind, Date.now()],
  );
  return { ok: true, active: true };
}

export type CommentAddResult = {
  ok: boolean;
  error?: string;
};

export async function addCommentAction(
  postId: number,
  body: string,
): Promise<CommentAddResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!Number.isFinite(postId)) return { ok: false, error: "잘못된 게시물입니다." };
  if (!body.trim()) return { ok: false, error: "내용을 입력해주세요." };
  const r = await addComment(postId, user.id, body);
  if (!r) return { ok: false, error: "내용을 입력해주세요." };
  return { ok: true };
}

export type GuestbookEntryDTO = {
  id: number;
  author_username: string;
  body: string;
  created_at: number;
};

export type GuestbookAddResult =
  | { ok: true; entry: GuestbookEntryDTO }
  | { ok: false; error: string };

// 페이지 사이즈는 lib/feed-config.ts. ("use server" 파일은 async export만 허용)
const PAGE_SIZE = 20;

export async function loadMoreFeedAction(before: number): Promise<FeedPost[]> {
  if (!Number.isFinite(before)) return [];
  const user = await getCurrentUser();
  return listFeed(user?.id ?? null, PAGE_SIZE, before);
}

const GUESTBOOK_MAX_LEN = 500;

export async function addGuestbookAction(
  ownerId: number,
  body: string,
): Promise<GuestbookAddResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!Number.isFinite(ownerId)) return { ok: false, error: "대상이 올바르지 않습니다." };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "내용을 입력해주세요." };
  const r = await addGuestbookEntry(ownerId, user.id, trimmed);
  if (!r) return { ok: false, error: "내용을 입력해주세요." };
  return {
    ok: true,
    entry: {
      id: r.id,
      author_username: user.username,
      body: trimmed.slice(0, GUESTBOOK_MAX_LEN),
      created_at: Date.now(),
    },
  };
}

// ───── 갤러리(자유 게시판) ─────

export type BoardVoteResult =
  | { ok: true; upvotes: number; downvotes: number; my: VoteKind | null }
  | { ok: false; error: string };

export async function voteBoardPostAction(
  postId: number,
  kind: VoteKind,
): Promise<BoardVoteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!Number.isFinite(postId)) return { ok: false, error: "잘못된 글입니다." };
  if (kind !== "up" && kind !== "down") return { ok: false, error: "잘못된 투표입니다." };
  const r = await voteBoardPost(postId, user.id, kind);
  if (!r) return { ok: false, error: "투표할 수 없는 글입니다." };
  return { ok: true, upvotes: r.upvotes, downvotes: r.downvotes, my: r.my };
}

const BOARD_COMMENT_MAX_LEN = 500;
const BOARD_NICK_MAX_LEN = 16;

export type BoardCommentDTO = {
  id: number;
  display_name: string;
  is_anon: boolean;
  body: string;
  created_at: number;
};

export type BoardCommentResult =
  | { ok: true; comment: BoardCommentDTO }
  | { ok: false; error: string };

export async function addBoardCommentAction(
  postId: number,
  body: string,
  anonNickname: string | null,
): Promise<BoardCommentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!Number.isFinite(postId)) return { ok: false, error: "잘못된 글입니다." };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "내용을 입력해주세요." };
  const anon =
    anonNickname && anonNickname.trim().length > 0
      ? anonNickname.trim().slice(0, BOARD_NICK_MAX_LEN)
      : null;
  const r = await addBoardComment({
    postId,
    userId: user.id,
    body: trimmed,
    anonNickname: anon,
  });
  if (!r) return { ok: false, error: "내용을 입력해주세요." };
  return {
    ok: true,
    comment: {
      id: r.id,
      display_name: anon ?? user.username,
      is_anon: !!anon,
      body: trimmed.slice(0, BOARD_COMMENT_MAX_LEN),
      created_at: Date.now(),
    },
  };
}

export type ReportResult =
  | { ok: true }
  | { ok: false; error: string };

export async function reportAction(
  targetType: ReportTarget,
  targetId: number,
  reason: ReportReason,
  body: string | null,
): Promise<ReportResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!REPORT_TARGETS.includes(targetType)) return { ok: false, error: "잘못된 대상입니다." };
  if (!Number.isFinite(targetId)) return { ok: false, error: "잘못된 대상입니다." };
  if (!REPORT_REASONS.some((r) => r.key === reason)) {
    return { ok: false, error: "사유를 선택해주세요." };
  }
  const r = await createReport({
    reporterId: user.id,
    targetType,
    targetId,
    reason,
    body,
  });
  if (!r.ok) {
    return { ok: false, error: r.duplicate ? "이미 신고한 항목입니다." : "신고 실패" };
  }
  return { ok: true };
}
