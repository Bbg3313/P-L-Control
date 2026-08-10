"use client";

import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinancial } from "@/contexts/financial-context";
import {
  DEFAULT_PAYROLL_FROM_EMAIL,
  DEFAULT_PAYROLL_FROM_NAME,
} from "@/lib/payroll-email-constants";
import {
  FIXED_PERSONNEL_NAMES,
  isOverseasTeam,
} from "@/lib/personnel";
import {
  loadPersonnelEmails,
  savePersonnelEmails,
  setPersonnelEmail,
  type PersonnelEmails,
} from "@/lib/personnel-emails-store";

const DOMESTIC_NAMES = FIXED_PERSONNEL_NAMES.filter(
  (name) => !isOverseasTeam(name)
);

export default function SettingsPage() {
  const { syncStatus, hydrated } = useFinancial();
  const [emails, setEmails] = useState<PersonnelEmails>({});
  const [emailsReady, setEmailsReady] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setEmails(loadPersonnelEmails());
    setEmailsReady(true);
  }, []);

  function persist(next: PersonnelEmails) {
    setEmails(next);
    savePersonnelEmails(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          데이터 공유·급여명세서 메일·접속 설정입니다.
        </p>
      </div>

      <div className="rounded-lg border border-border/80 p-4">
        <h2 className="text-sm font-medium">데이터 저장 (URL 공유)</h2>
        {!hydrated ? (
          <p className="mt-2 text-sm text-muted-foreground">확인 중…</p>
        ) : syncStatus === "cloud" ? (
          <p className="mt-2 text-sm text-emerald-700">
            서버에 저장 중입니다. 같은 URL·로그인 계정으로 접속하면 모두 같은
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
        <h2 className="text-sm font-medium">급여명세서 메일 (Resend)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          발신:{" "}
          <span className="font-medium text-foreground">
            {DEFAULT_PAYROLL_FROM_NAME} &lt;{DEFAULT_PAYROLL_FROM_EMAIL}&gt;
          </span>
        </p>
        <ol className="mt-3 list-inside list-decimal space-y-1.5 rounded-md bg-muted/40 p-3 text-sm text-foreground">
          <li>
            <a
              href="https://resend.com/signup"
              className="font-medium text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Resend
            </a>
            가입 후 API Key 발급
          </li>
          <li>
            Domains에{" "}
            <code className="rounded bg-muted px-1 text-xs">
              bluebridge-global.com
            </code>{" "}
            추가 → DNS(SPF/DKIM) 등록·인증
          </li>
          <li>
            Vercel 환경 변수에{" "}
            <code className="rounded bg-muted px-1 text-xs">RESEND_API_KEY</code>{" "}
            등록 후 Redeploy (로컬은{" "}
            <code className="rounded bg-muted px-1 text-xs">.env.local</code>)
          </li>
          <li>아래 직원 이메일을 등록한 뒤 급여대장에서 일괄 발송</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          선택:{" "}
          <code className="rounded bg-muted px-1">PAYROLL_FROM_EMAIL</code>{" "}
          (기본 {DEFAULT_PAYROLL_FROM_EMAIL})
        </p>
      </div>

      <div className="rounded-lg border border-border/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">직원 이메일</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              급여명세서 수신 주소 (이 브라우저에 저장)
            </p>
          </div>
          {savedFlash ? (
            <span className="text-xs text-emerald-700">저장됨</span>
          ) : null}
        </div>
        {!emailsReady ? (
          <p className="mt-3 text-sm text-muted-foreground">불러오는 중…</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {DOMESTIC_NAMES.map((name) => (
              <div key={name} className="grid gap-1.5">
                <Label htmlFor={`email-${name}`}>{name}</Label>
                <Input
                  id={`email-${name}`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={emails[name] ?? ""}
                  onChange={(e) => {
                    setEmails(setPersonnelEmail(emails, name, e.target.value));
                  }}
                  onBlur={(e) => {
                    persist(setPersonnelEmail(emails, name, e.target.value));
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => persist(emails)}
          >
            이메일 저장
          </Button>
        </div>
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
