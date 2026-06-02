"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { CollapsibleExpenseCard } from "@/components/expenses/collapsible-expense-card";
import { PersonnelSection } from "@/components/expenses/personnel-section";
import { MonthlyRecordsEditor } from "@/components/shared/monthly-records-editor";
import { useFinancial } from "@/contexts/financial-context";
import { JUN_2026_INSURANCE_LABEL } from "@/lib/social-insurance-jun-2026";
import { formatPeriodLabel } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";

export function ExpensesPage() {
  const { getByType, personnel, personnelMonthlyTotal, reportingMonth } =
    useFinancial();
  const allExpenseRecords = getByType("expense");
  const monthExpenseRecords = allExpenseRecords.filter(
    (r) => r.date.slice(0, 7) === reportingMonth
  );
  const otherTotal = monthExpenseRecords.reduce((sum, r) => sum + r.amount, 0);
  const grandTotal = otherTotal + personnelMonthlyTotal;
  const allOtherTotal = allExpenseRecords.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 상단 고정: 제목 · 월 선택 · 총합 */}
      <div className="shrink-0 border-b border-slate-200/80 bg-slate-50 pb-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">비용</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              아래만 스크롤됩니다. ◀ ▶ 로 집계·저장 월을 바꿉니다.
            </p>
          </div>
          <ReportingMonthNav className="w-full lg:justify-self-end" />
        </div>

        <Card size="sm" className="mt-4 border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {formatPeriodLabel(reportingMonth)} 비용 총합
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-0 sm:grid-cols-[auto_1fr] sm:items-baseline sm:gap-x-6">
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(grandTotal)}
            </p>
            <p className="text-sm text-muted-foreground">
              인건비 {formatCurrency(personnelMonthlyTotal)}
              <span className="mx-2 text-border">·</span>
              기타 {formatCurrency(otherTotal)}
              {monthExpenseRecords.length > 0 &&
                ` (${monthExpenseRecords.length}건)`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 스크롤 영역 */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-4">
        <CollapsibleExpenseCard
          title="인건비"
          description={`고정 9명 · ${JUN_2026_INSURANCE_LABEL} 자동 계산 · 금액만 수정`}
          amount={personnelMonthlyTotal}
          meta={`${personnel.length}명 · 매월 동일`}
        >
          <PersonnelSection />
        </CollapsibleExpenseCard>

        <CollapsibleExpenseCard
          title="기타 비용"
          description={`전체 ${allExpenseRecords.length}건 · ${formatPeriodLabel(reportingMonth)} 합계 ${formatCurrency(otherTotal)}`}
          amount={allOtherTotal}
          meta={
            allExpenseRecords.length > 0
              ? `전체 ${allExpenseRecords.length}건`
              : "미등록"
          }
          defaultOpen
        >
          <MonthlyRecordsEditor
            kind="expense"
            records={allExpenseRecords}
            showRecordMonth
            editorOptions={{
              resetOnMonthChange: false,
              preserveRecordDates: true,
            }}
          />
        </CollapsibleExpenseCard>
      </div>
    </div>
  );
}
