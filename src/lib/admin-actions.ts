"use server";

import { getCurrentAdmin } from "./admin-auth";
import { audit } from "./audit";
import { dbBatch, dbRun } from "./db";

export type AdminActionResult = { ok: boolean; error?: string };

async function requireAdminEmail(): Promise<string | null> {
  const a = await getCurrentAdmin();
  return a?.email ?? null;
}

// ─── 콘텐츠 삭제 ──────────────────────────────────────────────

export async function adminDeletePostAction(
  postId: number,
): Promise<AdminActionResult> {
  const email = await requireAdminEmail();
  if (!email) return { ok: false, error: "관리자 권한이 없습니다." };
  if (!Number.isFinite(postId)) return { ok: false, error: "잘못된 ID" };
  await dbBatch([
    { sql: "DELETE FROM reactions WHERE post_id = ?", args: [postId] },
    { sql: "DELETE FROM comments WHERE post_id = ?", args: [postId] },
    { sql: "DELETE FROM posts WHERE id = ?", args: [postId] },
  ]);
  audit(null, {
    type: "report.create",
    meta: { kind: "admin_delete_post", admin: email, postId },
  });
  return { ok: true };
}

export async function adminDeleteBoardPostAction(
  postId: number,
): Promise<AdminActionResult> {
  const email = await requireAdminEmail();
  if (!email) return { ok: false, error: "관리자 권한이 없습니다." };
  if (!Number.isFinite(postId)) return { ok: false, error: "잘못된 ID" };
  await dbBatch([
    { sql: "DELETE FROM board_votes WHERE post_id = ?", args: [postId] },
    { sql: "DELETE FROM board_comments WHERE post_id = ?", args: [postId] },
    { sql: "DELETE FROM board_posts WHERE id = ?", args: [postId] },
  ]);
  audit(null, {
    type: "report.create",
    meta: { kind: "admin_delete_board_post", admin: email, postId },
  });
  return { ok: true };
}

export async function adminDeleteCommentAction(
  commentId: number,
): Promise<AdminActionResult> {
  const email = await requireAdminEmail();
  if (!email) return { ok: false, error: "관리자 권한이 없습니다." };
  if (!Number.isFinite(commentId)) return { ok: false, error: "잘못된 ID" };
  await dbRun("DELETE FROM comments WHERE id = ?", [commentId]);
  audit(null, {
    type: "report.create",
    meta: { kind: "admin_delete_comment", admin: email, commentId },
  });
  return { ok: true };
}

export async function adminDeleteBoardCommentAction(
  commentId: number,
): Promise<AdminActionResult> {
  const email = await requireAdminEmail();
  if (!email) return { ok: false, error: "관리자 권한이 없습니다." };
  if (!Number.isFinite(commentId)) return { ok: false, error: "잘못된 ID" };
  await dbRun("DELETE FROM board_comments WHERE id = ?", [commentId]);
  audit(null, {
    type: "report.create",
    meta: { kind: "admin_delete_board_comment", admin: email, commentId },
  });
  return { ok: true };
}

export async function adminDeleteGuestbookEntryAction(
  id: number,
): Promise<AdminActionResult> {
  const email = await requireAdminEmail();
  if (!email) return { ok: false, error: "관리자 권한이 없습니다." };
  if (!Number.isFinite(id)) return { ok: false, error: "잘못된 ID" };
  await dbRun("DELETE FROM guestbook_entries WHERE id = ?", [id]);
  audit(null, {
    type: "report.create",
    meta: { kind: "admin_delete_guestbook", admin: email, id },
  });
  return { ok: true };
}

// ─── 신고 처리 ─────────────────────────────────────────────────

export async function adminResolveReportAction(
  reportId: number,
  status: "resolved" | "rejected",
): Promise<AdminActionResult> {
  const email = await requireAdminEmail();
  if (!email) return { ok: false, error: "관리자 권한이 없습니다." };
  if (!Number.isFinite(reportId)) return { ok: false, error: "잘못된 ID" };
  if (status !== "resolved" && status !== "rejected")
    return { ok: false, error: "잘못된 상태" };
  await dbRun("UPDATE reports SET status = ? WHERE id = ?", [status, reportId]);
  audit(null, {
    type: "report.create",
    meta: { kind: "admin_resolve_report", admin: email, reportId, status },
  });
  return { ok: true };
}

// 신고 + 대상 삭제(원샷).
export async function adminResolveAndDeleteAction(
  reportId: number,
  targetType: string,
  targetId: number,
): Promise<AdminActionResult> {
  const email = await requireAdminEmail();
  if (!email) return { ok: false, error: "관리자 권한이 없습니다." };

  let r: AdminActionResult = { ok: true };
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
    default:
      return { ok: false, error: "지원하지 않는 대상" };
  }
  if (!r.ok) return r;
  await dbRun("UPDATE reports SET status = ? WHERE id = ?", ["resolved", reportId]);
  return { ok: true };
}
