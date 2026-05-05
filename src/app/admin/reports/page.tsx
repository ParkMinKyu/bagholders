import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { dbAll } from "@/lib/db";
import { AdminReportRow } from "@/components/AdminReportRow";
import { fmtTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "신고 큐",
  robots: { index: false, follow: false },
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await getCurrentAdmin();
  if (!me) redirect("/admin/login");
  const sp = await searchParams;
  const status =
    sp.status === "resolved" || sp.status === "rejected" ? sp.status : "pending";

  const rows = await dbAll<{
    id: number;
    reporter_username: string | null;
    target_type: string;
    target_id: number;
    reason: string;
    body: string | null;
    status: string;
    created_at: number;
  }>(
    `SELECT r.id, u.username AS reporter_username,
            r.target_type, r.target_id, r.reason, r.body, r.status, r.created_at
     FROM reports r
     LEFT JOIN users u ON u.id = r.reporter_id
     WHERE r.status = ?
     ORDER BY r.created_at DESC
     LIMIT 200`,
    [status],
  );

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="text-xs text-bag-mute px-1">
        <Link href="/admin" prefetch={false} className="hover:text-bag-accent">
          ← 대시보드
        </Link>
      </div>

      <header className="panel p-5">
        <h1 className="text-xl font-black">🚩 신고 큐</h1>
        <p className="text-bag-mute text-xs mt-1">
          “대상 삭제 + 처리”를 누르면 대상 콘텐츠가 영구 삭제되고 신고도 처리됨
          상태로 전환됩니다.
        </p>
      </header>

      <nav className="panel p-1 flex gap-1">
        <TabLink current={status} value="pending" label="대기중" />
        <TabLink current={status} value="resolved" label="처리됨" />
        <TabLink current={status} value="rejected" label="기각됨" />
      </nav>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-bag-mute text-sm">
          {status === "pending"
            ? "처리할 신고가 없습니다."
            : "이 카테고리에 항목이 없습니다."}
        </div>
      ) : (
        <ol className="panel divide-y divide-bag-border">
          {rows.map((r) => (
            <div key={r.id}>
              <div className="px-4 pt-3 text-[10px] text-bag-mute">
                #{r.id} · {fmtTime(Number(r.created_at))}
              </div>
              <AdminReportRow
                report={{
                  id: Number(r.id),
                  reporter_username: r.reporter_username,
                  target_type: r.target_type,
                  target_id: Number(r.target_id),
                  reason: r.reason,
                  body: r.body,
                  status: r.status,
                  created_at: Number(r.created_at),
                }}
              />
            </div>
          ))}
        </ol>
      )}
    </div>
  );
}

function TabLink({
  current,
  value,
  label,
}: {
  current: string;
  value: string;
  label: string;
}) {
  const active = current === value;
  const href = value === "pending" ? "/admin/reports" : `/admin/reports?status=${value}`;
  return (
    <Link
      href={href}
      prefetch={false}
      className={`flex-1 text-center text-sm font-bold py-2 rounded-md transition ${
        active
          ? "bg-bag-accent/15 text-bag-accent"
          : "text-bag-mute hover:text-white hover:bg-white/5"
      }`}
    >
      {label}
    </Link>
  );
}
