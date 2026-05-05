"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { addGuestbookAction, type GuestbookEntryDTO } from "@/lib/actions";
import { fmtTime } from "@/lib/format";

const GUESTBOOK_MAX = 500;

export function GuestbookPanel({
  ownerId,
  ownerUsername,
  isSelf,
  isAuthed,
  initial,
}: {
  ownerId: number;
  ownerUsername: string;
  isSelf: boolean;
  isAuthed: boolean;
  initial: GuestbookEntryDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<GuestbookEntryDTO[]>(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // ESC로 닫기 + 모달 열렸을 때 body 스크롤 잠금.
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
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await addGuestbookAction(ownerId, trimmed);
      if (!res.ok) {
        setError(res.error ?? "등록 실패");
        return;
      }
      // 새 항목을 최상단에 prepend (목록은 최신순).
      setEntries((prev) => [res.entry, ...prev]);
      setBody("");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="방명록 열기"
        title="방명록"
        className="inline-flex items-center gap-1 rounded-md border border-bag-border bg-bag-panel px-2.5 py-1 text-xs hover:border-bag-accent hover:text-bag-accent transition flex-shrink-0"
      >
        <span>✍️</span>
        <span className="font-mono">{entries.length}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-bag-panel border border-bag-border w-full sm:max-w-lg rounded-t-xl sm:rounded-xl max-h-[85vh] sm:max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`@${ownerUsername} 방명록`}
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-bag-border">
              <h2 className="font-bold text-sm">
                ✍️ <span>@{ownerUsername}</span> 방명록 ({entries.length})
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="rounded-md w-7 h-7 flex items-center justify-center text-bag-mute hover:text-white hover:bg-white/5"
              >
                ✕
              </button>
            </header>

            <div className="px-4 py-3 border-b border-bag-border">
              {isAuthed ? (
                <form onSubmit={handleSubmit} className="space-y-2">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={2}
                    maxLength={GUESTBOOK_MAX}
                    placeholder={
                      isSelf
                        ? "본인 방명록에 한마디 (다짐? 푸념?)"
                        : "한마디 남겨보세요"
                    }
                    className="input"
                    disabled={pending}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-bag-mute">
                      {body.length}/{GUESTBOOK_MAX}
                    </span>
                    <button
                      type="submit"
                      disabled={!body.trim() || pending}
                      className="btn-primary !py-1 !px-3 text-xs"
                    >
                      {pending ? "등록 중…" : "남기기"}
                    </button>
                  </div>
                  {error && <p className="text-bag-accent text-xs">{error}</p>}
                </form>
              ) : (
                <div className="text-xs text-bag-mute">
                  <Link
                    href="/login"
                    prefetch={false}
                    className="text-bag-accent hover:underline"
                  >
                    로그인
                  </Link>
                  {" "}하면 방명록을 남길 수 있어요.
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {entries.length === 0 ? (
                <div className="text-center text-bag-mute text-xs py-10">
                  아직 아무도 다녀가지 않았습니다.
                </div>
              ) : (
                <ol className="divide-y divide-bag-border">
                  {entries.map((g) => (
                    <li key={g.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between">
                        <Link
                          href={`/u/${g.author_username}`}
                          prefetch={false}
                          onClick={() => setOpen(false)}
                          className="font-bold text-sm hover:text-bag-accent"
                        >
                          @{g.author_username}
                        </Link>
                        <span className="text-[11px] text-bag-mute">
                          {fmtTime(g.created_at)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed mt-1">
                        {g.body}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
