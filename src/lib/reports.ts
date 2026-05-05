import { dbRun } from "./db";

export const REPORT_TARGETS = [
  "post",
  "board_post",
  "comment",
  "board_comment",
  "guestbook",
  "user",
] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  { key: "spam", label: "스팸·광고" },
  { key: "abuse", label: "욕설·비방" },
  { key: "porn", label: "음란·선정" },
  { key: "flood", label: "도배" },
  { key: "scam", label: "사기·시세조작" },
  { key: "etc", label: "기타" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

export const REPORT_BODY_MAX = 500;

export async function createReport(args: {
  reporterId: number;
  targetType: ReportTarget;
  targetId: number;
  reason: ReportReason;
  body: string | null;
}): Promise<{ ok: boolean; duplicate?: boolean }> {
  const trimmed = (args.body ?? "").trim().slice(0, REPORT_BODY_MAX) || null;
  try {
    await dbRun(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [
        args.reporterId,
        args.targetType,
        args.targetId,
        args.reason,
        trimmed,
        Date.now(),
      ],
    );
    return { ok: true };
  } catch (e) {
    // UNIQUE 위반 — 이미 신고함
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) return { ok: false, duplicate: true };
    throw e;
  }
}
