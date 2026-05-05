"use client";

import { useState, useTransition } from "react";
import {
  adminResolveAndDeleteAction,
  adminResolveReportAction,
} from "@/lib/admin-actions";
import { useRouter } from "next/navigation";

const REASON_LABELS: Record<string, string> = {
  spam: "스팸·광고",
  abuse: "욕설·비방",
  porn: "음란·선정",
  flood: "도배",
  scam: "사기·시세조작",
  etc: "기타",
};

const TARGET_LABELS: Record<string, string> = {
  post: "인증 글",
  board_post: "갤러리 글",
  comment: "댓글",
  board_comment: "갤러리 댓글",
  guestbook: "방명록",
  user: "사용자",
};

function targetLink(targetType: string, targetId: number): string | null {
  switch (targetType) {
    case "post":
      return `/p/${targetId}`;
    case "board_post":
      return `/b/${targetId}`;
    default:
      return null;
  }
}

export function AdminReportRow({
  report,
}: {
  report: {
    id: number;
    reporter_username: string | null;
    target_type: string;
    target_id: number;
    reason: string;
    body: string | null;
    status: string;
    created_at: number;
  };
}) {
  const router = useRouter();
  const [done, setDone] = useState<"resolved" | "rejected" | "deleted" | null>(
    report.status === "pending" ? null : (report.status as "resolved" | "rejected"),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const link = targetLink(report.target_type, report.target_id);

  function handle(action: "resolve" | "reject" | "delete") {
    setError(null);
    startTransition(async () => {
      let r;
      if (action === "delete") {
        r = await adminResolveAndDeleteAction(
          report.id,
          report.target_type,
          report.target_id,
        );
        if (r.ok) setDone("deleted");
      } else if (action === "resolve") {
        r = await adminResolveReportAction(report.id, "resolved");
        if (r.ok) setDone("resolved");
      } else {
        r = await adminResolveReportAction(report.id, "rejected");
        if (r.ok) setDone("rejected");
      }
      if (!r.ok) {
        setError(r.error ?? "처리 실패");
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-3 space-y-2">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="badge border-bag-accent/40 text-bag-accent">
            {REASON_LABELS[report.reason] ?? report.reason}
          </span>
          <span className="text-bag-mute text-xs">
            {TARGET_LABELS[report.target_type] ?? report.target_type} #
            {report.target_id}
          </span>
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-bag-accent text-xs hover:underline"
            >
              열기 ↗
            </a>
          ) : null}
        </div>
        <span className="text-[11px] text-bag-mute">
          @{report.reporter_username ?? "?"}
        </span>
      </div>
      {report.body && (
        <p className="text-xs text-bag-mute whitespace-pre-wrap">{report.body}</p>
      )}

      {done ? (
        <p
          className={`text-xs font-bold ${
            done === "deleted"
              ? "text-bag-accent"
              : done === "resolved"
                ? "text-emerald-400"
                : "text-bag-mute"
          }`}
        >
          {done === "deleted"
            ? "삭제 완료"
            : done === "resolved"
              ? "처리됨"
              : "기각"}
        </p>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handle("delete")}
            disabled={pending}
            className="btn-primary !py-1 !px-2 text-[11px]"
          >
            대상 삭제 + 처리
          </button>
          <button
            type="button"
            onClick={() => handle("resolve")}
            disabled={pending}
            className="btn !py-1 !px-2 text-[11px]"
          >
            처리됨
          </button>
          <button
            type="button"
            onClick={() => handle("reject")}
            disabled={pending}
            className="btn !py-1 !px-2 text-[11px] !text-bag-mute"
          >
            기각
          </button>
        </div>
      )}

      {error && <p className="text-bag-accent text-xs">{error}</p>}
    </li>
  );
}
