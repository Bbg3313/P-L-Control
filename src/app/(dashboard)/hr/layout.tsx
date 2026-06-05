import { HrSectionNav } from "@/components/hr/hr-section-nav";

export default function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <header className="sticky top-0 z-30 w-full shrink-0 border-b border-slate-200/80 bg-slate-50/95 px-0 pb-4 shadow-sm backdrop-blur-sm">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">인사</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            근로계약서·인사기록 등 팀 인사 정보를 관리합니다.
          </p>
          <HrSectionNav />
        </div>
      </header>
      {children}
    </div>
  );
}
