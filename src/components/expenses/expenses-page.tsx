"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { CollapsibleExpenseCard } from "@/components/expenses/collapsible-expense-card";
import { PersonnelSection } from "@/components/expenses/personnel-section";
import { MonthlyRecordsEditor } from "@/components/shared/monthly-records-editor";
import { useFinancial } from "@/contexts/financial-context";
import { ENTITY_PURCHASE_LABEL } from "@/lib/brand";
import { JUN_2026_INSURANCE_LABEL } from "@/lib/social-insurance-jun-2026";
import { formatPeriodLabel } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import { summarizeExpenseVat, summarizeVatSettlement } from "@/lib/vat";

export function ExpensesPage() {
  const {
    records,
    getByType,
    personnel,
    personnelMonthlyTotal,
    reportingMonth,
  } = useFinancial();
  const allExpenseRecords = getByType("expense");
  const monthExpenseRecords = allExpenseRecords.filter(
    (r) => r.date.slice(0, 7) === reportingMonth
  );
  const expenseVat = useMemo(
    () => summarizeExpenseVat(monthExpenseRecords),
    [monthExpenseRecords]
  );
  const vatSettlement = useMemo(
    () => summarizeVatSettlement(records, reportingMonth),
    [records, reportingMonth]
  );
  const otherTotal = expenseVat.supplyTotal;
  const grandTotal = otherTotal + personnelMonthlyTotal;
  const allOtherTotal = useMemo(
    () => summarizeExpenseVat(allExpenseRecords).supplyTotal,
    [allExpenseRecords]
  );

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <header className="sticky top-0 z-30 w-full max-w-full shrink-0 border-b border-slate-200/80 bg-slate-50/95 pb-4 shadow-sm backdrop-blur-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">비용</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ENTITY_PURCHASE_LABEL} 매입 · ◀ ▶ 로 집계·저장 월을 바꿉니다.
            </p>
          </div>
          <ReportingMonthNav className="w-full lg:justify-self-end" />
        </div>

        <Card
          size="sm"
          className="mt-4 box-border w-full max-w-full border-slate-200/80 bg-white shadow-sm ring-0"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {formatPeriodLabel(reportingMonth)} 비용 총합
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-0 sm:flex-row sm:items-baseline sm:gap-x-6">
            <div>
              <p className="shrink-0 text-2xl font-semibold tabular-nums">
                {formatCurrency(grandTotal)}
              </p>
              {(expenseVat.vatTotal > 0 || vatSettlement.vatRefund > 0) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  계산서 {expenseVat.vatIncludedCount}건 · 매입세 합산{" "}
                  {formatCurrency(expenseVat.vatTotal)}
                  <span className="mx-1 text-border">·</span>
                  대시보드 환급 {formatCurrency(vatSettlement.vatRefund)}
                </p>
              )}
            </div>
            <p className="min-w-0 text-sm leading-relaxed text-muted-foreground">
              인건비 {formatCurrency(personnelMonthlyTotal)}
              <span className="mx-2 text-border">·</span>
              기타 {formatCurrency(otherTotal)}
              {monthExpenseRecords.length > 0 &&
                ` (${monthExpenseRecords.length}건)`}
            </p>
          </CardContent>
        </Card>
      </header>

      <div className="w-full max-w-full space-y-3 pb-4 pt-4">
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
          description={`${ENTITY_PURCHASE_LABEL} · 전체 ${allExpenseRecords.length}건 · ${formatPeriodLabel(reportingMonth)} 합계 ${formatCurrency(otherTotal)}`}
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
