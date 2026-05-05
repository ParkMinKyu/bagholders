import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { dbGet } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const me = await getCurrentAdmin();
  if (!me) redirect("/admin/login");

  const [pending, totalReports, totalUsers, totalPosts, totalBoardPosts] =
    await Promise.all([
      dbGet<{ n: number }>(
        "SELECT COUNT(*) AS n FROM reports WHERE status = 'pending'",
      ),
      dbGet<{ n: number }>("SELECT COUNT(*) AS n FROM reports"),
      dbGet<{ n: number }>("SELECT COUNT(*) AS n FROM users"),
      dbGet<{ n: number }>("SELECT COUNT(*) AS n FROM posts"),
      dbGet<{ n: number }>("SELECT COUNT(*) AS n FROM board_posts"),
    ]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <header className="panel p-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">🛡 관리자</h1>
          <p className="text-bag-mute text-xs mt-1">
            로그인 이메일: <span className="font-mono">{me.email}</span>
          </p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="btn !py-1 !px-3 text-xs">
            로그아웃
          </button>
        </form>
      </header>

      <section>
        <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider mb-2 px-1">
          신고
        </h2>
        <Link
          href="/admin/reports"
          prefetch={false}
          className="panel block p-4 hover:bg-bag-accent/5 transition"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-bold">대기중인 신고</span>
            <span
              className={`font-mono font-black text-2xl ${
                Number(pending?.n ?? 0) > 0 ? "text-bag-accent" : "text-bag-mute"
              }`}
            >
              {Number(pending?.n ?? 0)}
            </span>
          </div>
          <p className="text-[11px] text-bag-mute mt-1">
            전체 신고 {Number(totalReports?.n ?? 0)}건
          </p>
        </Link>
      </section>

      <section>
        <h2 className="text-xs font-bold text-bag-mute uppercase tracking-wider mb-2 px-1">
          통계
        </h2>
        <div className="panel divide-y divide-bag-border">
          <Stat label="가입자" value={Number(totalUsers?.n ?? 0)} />
          <Stat label="인증 글" value={Number(totalPosts?.n ?? 0)} />
          <Stat label="갤러리 글" value={Number(totalBoardPosts?.n ?? 0)} />
        </div>
      </section>

      <p className="text-[11px] text-bag-mute px-1">
        피드/갤러리 글에 직접 가도{" "}
        <span className="text-white">[관리자 삭제]</span> 버튼이 보입니다.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between px-4 py-3">
      <span className="text-sm">{label}</span>
      <span className="font-mono font-bold">{value.toLocaleString("ko-KR")}</span>
    </div>
  );
}
