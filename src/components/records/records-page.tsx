"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonnelSection } from "@/components/expenses/personnel-section";
import { useFinancial } from "@/contexts/financial-context";
import { formatCurrency } from "@/lib/format";
import type { TransactionType } from "@/lib/types";
import { AddRecordDialog } from "./add-record-dialog";
import { RecordsTable } from "./records-table";

const pageConfig = {
  revenue: {
    title: "매출",
    description: "매출 내역을 수기로 등록·관리합니다. 데이터는 브라우저에 저장됩니다.",
    emptyMessage: "등록된 매출이 없습니다. 「기록 추가」로 입력하세요.",
    totalLabel: "전체 매출 합계",
  },
  expense: {
    title: "비용",
    description:
      "고정 인건비와 기타 비용(사무실, 광고 등)을 나누어 관리합니다. 대시보드에 모두 반영됩니다.",
    emptyMessage: "등록된 기타 비용이 없습니다. 「기록 추가」로 입력하세요.",
    totalLabel: "기타 비용 합계",
  },
} as const;

interface RecordsPageProps {
  type: TransactionType;
}

export function RecordsPage({ type }: RecordsPageProps) {
  const { getByType, personnelMonthlyTotal } = useFinancial();
  const records = getByType(type);
  const config = pageConfig[type];
  const otherTotal = records.reduce((sum, r) => sum + r.amount, 0);
  const isExpense = type === "expense";
  const grandTotal = isExpense ? otherTotal + personnelMonthlyTotal : otherTotal;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {config.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {config.description}
          </p>
        </div>
        <AddRecordDialog type={type} />
      </div>

      {isExpense ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                인건비 (고정) /월
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(personnelMonthlyTotal)}
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {config.totalLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(otherTotal)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {records.length}건
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                비용 총합 /월
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(grandTotal)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {config.totalLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(grandTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {records.length}건
            </p>
          </CardContent>
        </Card>
      )}

      {isExpense && <PersonnelSection />}

      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">
            {isExpense ? "기타 비용" : config.title}
          </CardTitle>
          {isExpense && (
            <p className="text-sm text-muted-foreground">
              사무실, 광고 등 인건비 외 항목
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          <RecordsTable records={records} emptyMessage={config.emptyMessage} />
        </CardContent>
      </Card>
    </div>
  );
}
