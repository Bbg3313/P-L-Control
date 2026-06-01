import { LogoutButton } from "@/components/auth/logout-button";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          고정비 예비금 및 보고 기간 설정은 곧 추가됩니다.
        </p>
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
