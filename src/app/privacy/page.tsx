import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "bagholders. 개인정보 처리에 관한 방침.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "개인정보처리방침 · bagholders.", url: "/privacy" },
};

const EFFECTIVE_DATE = "2026-05-05";

export default function PrivacyPage() {
  return (
    <article className="panel p-6 prose-sm max-w-none">
      <h1 className="text-2xl font-black mb-2">개인정보처리방침</h1>
      <p className="text-bag-mute text-sm">
        bagholders.(이하 “서비스”)는 「개인정보 보호법」을 준수하며, 다음과 같이
        개인정보를 처리합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <ul>
          <li>
            <strong>필수</strong>: 닉네임(아이디), 비밀번호 (단방향 해시 저장)
          </li>
          <li>
            <strong>자동 수집</strong>: 세션 쿠키, 접속 IP, User-Agent, 접속 시각
            (호스팅 제공자의 표준 로그)
          </li>
          <li>
            <strong>이용자 작성</strong>: 게시물(인증·갤러리), 댓글, 방명록, 첨부
            이미지
          </li>
        </ul>
      </Section>

      <Section title="2. 개인정보 수집 및 이용 목적">
        <ul>
          <li>회원 식별·인증 및 서비스 제공 (게시·댓글·랭킹·팔로우 등)</li>
          <li>부정 이용 방지, 보안·운영</li>
          <li>법령·이용약관 위반 시 사후 조치</li>
        </ul>
      </Section>

      <Section title="3. 보유 및 이용기간">
        <ul>
          <li>회원 탈퇴 또는 처리 목적 달성 시까지 보관</li>
          <li>관련 법령에 따라 일정 기간 보관할 수 있음</li>
          <li>
            업로드 이미지 등 콘텐츠는 회원 탈퇴 또는 게시물 삭제 시 파기 절차에
            따름
          </li>
        </ul>
      </Section>

      <Section title="4. 처리위탁 (제3자 처리자)">
        <p>서비스 제공을 위해 다음 사업자에 처리를 위탁합니다.</p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> (미국) — 웹 호스팅, 서버리스 함수,
            이미지 저장(Vercel Blob)
          </li>
          <li>
            <strong>Turso</strong> (미국) — 데이터베이스 호스팅(libSQL)
          </li>
          <li>
            <strong>Upbit</strong> — 시세 정보 조회 (개인정보 미전송)
          </li>
        </ul>
      </Section>

      <Section title="5. 정보주체의 권리">
        <p>
          이용자는 언제든 본인 개인정보의 열람·정정·삭제·처리정지를 요청할 수
          있습니다. 본인 닉네임으로 로그인 후 직접 작성 글·댓글·방명록을
          삭제하거나, 운영자에게 문의해 회원 탈퇴 및 파기를 요청할 수 있습니다.
        </p>
      </Section>

      <Section title="6. 쿠키 사용">
        <p>
          서비스는 로그인 상태 유지를 위한 세션 쿠키(<code>bag_session</code>)를
          사용합니다. 브라우저 설정에서 거부할 수 있으나, 거부 시 로그인 기능
          사용이 제한될 수 있습니다.
        </p>
      </Section>

      <Section title="7. 개인정보의 안전성 확보 조치">
        <ul>
          <li>비밀번호는 bcrypt로 단방향 해시 저장 (원문 미보관)</li>
          <li>HTTPS 전송 구간 암호화</li>
          <li>최소 권한 원칙에 따른 접근 통제</li>
          <li>외부 위탁 처리자는 표준 보안 정책을 따르는 사업자만 사용</li>
        </ul>
      </Section>

      <Section title="8. 만 14세 미만 아동의 개인정보 처리">
        <p>
          본 서비스는 만 14세 미만 아동의 회원가입을 받지 않으며, 인지된 경우
          즉시 계정과 관련 정보를 파기합니다.
        </p>
      </Section>

      <Section title="9. 방침 변경">
        <p>
          본 방침은 법령·서비스 변경에 따라 개정될 수 있습니다. 변경 시 본 페이지
          상단에 공지합니다.
        </p>
      </Section>

      <Section title="10. 문의처">
        <p>
          개인정보 관련 문의는 본 사이트의 운영자에게 해주시기 바랍니다.
        </p>
      </Section>

      <p className="text-bag-mute text-xs mt-6">
        시행일: {EFFECTIVE_DATE}
      </p>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-bold mb-2">{title}</h2>
      <div className="text-sm text-bag-mute leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&_strong]:text-white [&_code]:font-mono [&_code]:text-white [&_code]:text-xs [&_code]:bg-black/40 [&_code]:px-1 [&_code]:rounded">
        {children}
      </div>
    </section>
  );
}
