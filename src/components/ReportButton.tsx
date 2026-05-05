"use client";

import { useEffect, useState, useTransition } from "react";
import { reportAction } from "@/lib/actions";

const REPORT_REASONS = [
  { key: "spam", label: "스팸·광고" },
  { key: "abuse", label: "욕설·비방" },
  { key: "porn", label: "음란·선정" },
  { key: "flood", label: "도배" },
  { key: "scam", label: "사기·시세조작" },
  { key: "etc", label: "기타" },
] as const;
type ReasonKey = (typeof REPORT_REASONS)[number]["key"];

const BODY_MAX = 500;

type Target =
  | "post"
  | "board_post"
  | "comment"
  | "board_comment"
  | "guestbook"
  | "user";

export function ReportButton({
  targetType,
  targetId,
  isAuthed,
  variant = "small",
}: {
  targetType: Target;
  targetId: number;
  isAuthed: boolean;
  variant?: "small" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReasonKey | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await reportAction(targetType, targetId, reason, body || null);
      if (!res.ok) {
        setError(res.error ?? "신고 실패");
        return;
      }
      setSubmitted(true);
    });
  }

  function close() {
    setOpen(false);
    // 닫을 때 폼 리셋
    setTimeout(() => {
      setReason(null);
      setBody("");
      setError(null);
      setSubmitted(false);
    }, 200);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!isAuthed) {
            window.location.href = "/login";
            return;
          }
          setOpen(true);
        }}
        title="신고"
        aria-label="신고"
        className={
          variant === "icon"
            ? "text-bag-mute hover:text-bag-accent transition text-sm"
            : "text-[11px] text-bag-mute hover:text-bag-accent opacity-70 hover:opacity-100"
        }
      >
        🚩{variant === "small" && <span className="ml-1">신고</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={close}
        >
          <div
            className="bg-bag-panel border border-bag-border w-full sm:max-w-md rounded-t-xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="신고하기"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-bag-border">
              <h2 className="font-bold text-sm">🚩 신고하기</h2>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="rounded-md w-7 h-7 flex items-center justify-center text-bag-mute hover:text-white hover:bg-white/5"
              >
                ✕
              </button>
            </header>

            {submitted ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-sm">
                  신고가 접수되었습니다.<br />
                  운영자가 검토 후 조치합니다.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="btn-primary !py-1 !px-4 text-xs"
                >
                  확인
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-bag-mute mb-2">신고 사유</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {REPORT_REASONS.map((r) => (
                      <button
                        type="button"
                        key={r.key}
                        onClick={() => setReason(r.key)}
                        className={`px-2 py-2 rounded-md border text-xs transition ${
                          reason === r.key
                            ? "border-bag-accent bg-bag-accent/15 text-bag-accent"
                            : "border-bag-border text-bag-mute hover:text-white"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-bag-mute">상세 (선택)</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    maxLength={BODY_MAX}
                    placeholder="추가 설명이 필요하면 입력하세요."
                    className="input mt-1"
                    disabled={pending}
                  />
                  <p className="text-[10px] text-bag-mute mt-1 text-right">
                    {body.length}/{BODY_MAX}
                  </p>
                </div>

                {error && <p className="text-bag-accent text-xs">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="btn !py-1.5 text-xs flex-1"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!reason || pending}
                    className="btn-primary !py-1.5 text-xs flex-1"
                  >
                    {pending ? "전송 중…" : "신고하기"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
