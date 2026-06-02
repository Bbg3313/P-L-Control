"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { CollapsibleExpenseCard } from "@/components/expenses/collapsible-expense-card";
import { MonthlyRecordsEditor } from "@/components/shared/monthly-records-editor";
import { useFinancial } from "@/contexts/financial-context";
import { formatPeriodLabel } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { ImportRevenueDialog } from "./import-revenue-dialog";

export function RevenuePage() {
  const { getByType, reportingMonth } = useFinancial();
  const records = getByType("revenue").filter(
    (r) => r.date.slice(0, 7) === reportingMonth
  );
  const total = records.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <header className="sticky top-0 z-30 w-full max-w-full shrink-0 border-b border-slate-200/80 bg-slate-50/95 pb-4 shadow-sm backdrop-blur-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">매출</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ◀ ▶ 로 집계·저장 월을 바꾼 뒤 해당 월 항목을 입력·저장하세요.
            </p>
            <div className="mt-3">
              <ImportRevenueDialog />
            </div>
          </div>
          <ReportingMonthNav className="w-full lg:justify-self-end" />
        </div>

        <Card
          size="sm"
          className="mt-4 box-border w-full max-w-full border-slate-200/80 bg-white shadow-sm ring-0"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {formatPeriodLabel(reportingMonth)} 매출 합계
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 pt-0 sm:flex-row sm:items-baseline sm:gap-x-4">
            <p className="shrink-0 text-2xl font-semibold tabular-nums">
              {formatCurrency(total)}
            </p>
            <p className="text-sm text-muted-foreground">
              {records.length > 0 ? `${records.length}건` : "미등록"}
            </p>
          </CardContent>
        </Card>
      </header>

      <div className="w-full max-w-full space-y-3 pb-4 pt-4">
        <CollapsibleExpenseCard
          title={`${formatPeriodLabel(reportingMonth)} 매출`}
          description="매출처 · 카테고리 · 금액"
          amount={total}
          meta={records.length > 0 ? `${records.length}건` : "미등록"}
          defaultOpen
        >
          <MonthlyRecordsEditor kind="revenue" records={records} />
        </CollapsibleExpenseCard>
      </div>
    </div>
  );
}
