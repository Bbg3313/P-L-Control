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
    <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">매출</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            월별로 매출을 등록합니다. ◀ ▶ 로 월을 바꾼 뒤 해당 월 항목을
            입력·저장하세요.
          </p>
        </div>
        <ImportRevenueDialog />
      </div>

      <ReportingMonthNav className="max-w-md" />

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {formatPeriodLabel(reportingMonth)} 매출 합계
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(total)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{records.length}건</p>
        </CardContent>
      </Card>

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
  );
}
