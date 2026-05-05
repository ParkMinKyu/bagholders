import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "bagholders. 서비스 이용약관 및 면책 고지.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "이용약관 · bagholders.", url: "/terms" },
};

const EFFECTIVE_DATE = "2026-05-05";

export default function TermsPage() {
  return (
    <article className="panel p-6 max-w-none">
      <h1 className="text-2xl font-black mb-2">이용약관</h1>
      <p className="text-bag-mute text-sm">
        bagholders. (이하 “서비스”) 이용에 관한 약관입니다. 회원가입 또는 서비스
        이용으로 본 약관에 동의하는 것으로 간주됩니다.
      </p>

      <Section title="1. 서비스의 성격">
        <p>
          본 서비스는 사용자가 자발적으로 작성한 자조·유머 콘텐츠를 공유하는
          커뮤니티 플랫폼입니다.
        </p>
        <p className="mt-2 border border-bag-accent/40 bg-red-500/5 rounded p-3 text-sm">
          <strong>본 서비스는 투자 정보를 제공하지 않습니다.</strong> 모든
          게시물은 사용자가 작성한 유머 콘텐츠이며, 어떠한 게시물도 매매
          추천·전망·분석이 아닙니다. 가격 정보는 사용자가 직접 입력한 값이며 실제
          시세와 다를 수 있습니다. <strong>투자 판단의 책임은 본인에게 있습니다.</strong>
        </p>
      </Section>

      <Section title="2. 회원가입 및 계정 관리">
        <ul>
          <li>닉네임과 비밀번호로 회원가입할 수 있습니다.</li>
          <li>본인의 계정 보안에 대한 책임은 회원에게 있습니다.</li>
          <li>만 14세 미만은 가입할 수 없습니다.</li>
          <li>회원은 언제든 탈퇴를 요청할 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="3. 이용자의 의무">
        <p>회원은 다음 행위를 해서는 안 됩니다:</p>
        <ul>
          <li>타인의 권리(저작권·초상권·명예 등)를 침해하는 행위</li>
          <li>허위·차별·혐오·불법 콘텐츠의 게시</li>
          <li>스팸, 도배, 무단 광고·홍보, 다단계·투자 권유</li>
          <li>실제 시세 조작이나 시장 교란을 의도하는 발언</li>
          <li>타인 사칭·계정 도용</li>
          <li>서비스의 정상 운영을 방해하는 행위 (스크래핑·자동화 봇 등 비정상 트래픽)</li>
        </ul>
      </Section>

      <Section title="4. 게시물 관리">
        <ul>
          <li>운영자는 본 약관·관련 법령에 위반되는 게시물을 사전 통보 없이 삭제·블라인드 처리할 수 있습니다.</li>
          <li>회원이 작성한 게시물의 저작권은 작성자에게 귀속되며, 서비스는 운영·홍보 목적의 비독점적 사용권을 갖습니다.</li>
          <li>회원 탈퇴 시 작성 게시물은 익명 처리되거나 삭제될 수 있습니다.</li>
        </ul>
      </Section>

      <Section title="5. 면책">
        <p>서비스는 다음 사항에 대해 책임을 지지 않습니다:</p>
        <ul>
          <li>사용자가 작성한 콘텐츠의 정확성·신뢰성</li>
          <li>본 서비스에 게시된 정보를 토대로 한 투자·거래 판단의 결과</li>
          <li>천재지변, 통신 장애, 호스팅·DB 제공자의 장애 등 불가항력 사유로 인한 서비스 중단</li>
          <li>이용자 간 분쟁 또는 이용자와 제3자 간 분쟁</li>
        </ul>
      </Section>

      <Section title="6. 서비스의 변경 및 종료">
        <p>
          서비스는 운영상·기술상의 사유로 일부 또는 전부의 기능을 변경하거나
          중단할 수 있으며, 합리적인 범위 내에서 사전 공지합니다.
        </p>
      </Section>

      <Section title="7. 약관의 변경">
        <p>
          서비스는 약관을 개정할 수 있으며, 변경 시 본 페이지에 공지합니다.
          공지 후 7일 이내 이의제기가 없거나 변경된 약관 하에서 서비스를 계속
          이용하는 경우 동의한 것으로 간주합니다.
        </p>
      </Section>

      <Section title="8. 준거법 및 관할">
        <p>
          본 약관은 대한민국 법률에 따라 해석·적용되며, 분쟁 발생 시 민사소송법상
          관할 법원을 따릅니다.
        </p>
      </Section>

      <p className="text-bag-mute text-xs mt-6">시행일: {EFFECTIVE_DATE}</p>
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
      <div className="text-sm text-bag-mute leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>p]:mt-1 [&_strong]:text-white">
        {children}
      </div>
    </section>
  );
}
