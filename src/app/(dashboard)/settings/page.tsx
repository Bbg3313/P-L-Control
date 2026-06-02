"use client";

import { LogoutButton } from "@/components/auth/logout-button";
import { useFinancial } from "@/contexts/financial-context";

export default function SettingsPage() {
  const { syncStatus, hydrated } = useFinancial();

  return (
    <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          데이터 공유·접속 설정입니다.
        </p>
      </div>

      <div className="rounded-lg border border-border/80 p-4">
        <h2 className="text-sm font-medium">데이터 저장 (URL 공유)</h2>
        {!hydrated ? (
          <p className="mt-2 text-sm text-muted-foreground">확인 중…</p>
        ) : syncStatus === "cloud" ? (
          <p className="mt-2 text-sm text-emerald-700">
            서버에 저장 중입니다. 같은 URL·비밀번호로 접속하면 모두 같은
            매출·비용·인건비를 봅니다.
          </p>
        ) : (
          <div className="mt-2 space-y-3 text-sm text-muted-foreground">
            <p>
              지금은 이 브라우저에만 저장됩니다. 다른 사람에게 링크를 줘도
              데이터가 보이지 않습니다.
            </p>
            <ol className="list-inside list-decimal space-y-1.5 rounded-md bg-muted/40 p-3 text-foreground">
              <li>
                <a
                  href="https://vercel.com/dashboard"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Vercel 대시보드
                </a>
                에서 이 프로젝트를 엽니다.
              </li>
              <li>
                <strong>Storage</strong> →{" "}
                <strong>Upstash Redis</strong> (또는 Marketplace에서 Redis)
                연결/생성
              </li>
              <li>
                프로젝트에 연결 후{" "}
                <code className="rounded bg-muted px-1 text-xs">
                  UPSTASH_REDIS_REST_URL
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1 text-xs">
                  UPSTASH_REDIS_REST_TOKEN
                </code>{" "}
                환경 변수가 생기면 <strong>Redeploy</strong>
              </li>
              <li>배포 후 이 페이지에서 「서버에 저장 중」인지 확인</li>
            </ol>
            <p className="text-xs">
              로컬 개발(`npm run dev`)만 쓸 때는 프로젝트 폴더의{" "}
              <code className="rounded bg-muted px-1">.data/workspace.json</code>
              에 저장됩니다 (팀 공유는 Redis 연결 필요).
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border/80 p-4">
        <h2 className="text-sm font-medium">접속</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          공용 PC 등에서는 사용 후 로그아웃하세요.
        </p>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
