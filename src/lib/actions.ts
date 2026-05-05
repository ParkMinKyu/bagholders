"use server";

import { getCurrentUser } from "./auth";
import { addComment } from "./comments";
import { dbGet, dbRun } from "./db";
import { addGuestbookEntry } from "./guestbook";
import { REACTIONS } from "./post-kinds";

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

export type GuestbookAddResult = {
  ok: boolean;
  error?: string;
};

export async function addGuestbookAction(
  ownerId: number,
  body: string,
): Promise<GuestbookAddResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  if (!Number.isFinite(ownerId)) return { ok: false, error: "대상이 올바르지 않습니다." };
  if (!body.trim()) return { ok: false, error: "내용을 입력해주세요." };
  const r = await addGuestbookEntry(ownerId, user.id, body);
  if (!r) return { ok: false, error: "내용을 입력해주세요." };
  return { ok: true };
}
