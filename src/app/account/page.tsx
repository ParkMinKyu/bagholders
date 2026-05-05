import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "계정 설정",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  return (
    <div className="max-w-md mx-auto space-y-3">
      <div className="text-xs text-bag-mute px-1">
        <Link
          href={`/u/${me.username}`}
          prefetch={false}
          className="hover:text-bag-accent"
        >
          ← @{me.username}
        </Link>
      </div>
      <h1 className="text-xl font-black px-1">⚙️ 계정 설정</h1>

      <ol className="panel divide-y divide-bag-border">
        <Item
          href="/account/username"
          title="닉네임 변경"
          desc={`현재 @${me.username}`}
        />
        <Item
          href="/account/password"
          title="비밀번호 변경"
          desc="6자 이상의 새 비밀번호로 교체"
        />
        <Item
          href="/account/withdraw"
          title="회원 탈퇴"
          desc="계정과 관련 데이터 영구 삭제"
          danger
        />
      </ol>

      <div className="px-1 pt-2 text-[11px] text-bag-mute">
        문의:{" "}
        <a
          href="mailto:smartmingue@gmail.com"
          className="text-bag-accent hover:underline"
        >
          smartmingue@gmail.com
        </a>
      </div>
    </div>
  );
}

function Item({
  href,
  title,
  desc,
  danger,
}: {
  href: string;
  title: string;
  desc: string;
  danger?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        prefetch={false}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bag-accent/5 transition"
      >
        <div className="min-w-0">
          <div
            className={`font-bold text-sm ${
              danger ? "text-bag-accent" : "text-white"
            }`}
          >
            {title}
          </div>
          <div className="text-[11px] text-bag-mute mt-0.5 truncate">{desc}</div>
        </div>
        <span className="text-bag-mute">›</span>
      </Link>
    </li>
  );
}
