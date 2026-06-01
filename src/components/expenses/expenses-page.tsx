"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OtherExpensesEditor } from "@/components/expenses/other-expenses-editor";
import { PersonnelSection } from "@/components/expenses/personnel-section";
import { useFinancial } from "@/contexts/financial-context";
import { formatCurrency } from "@/lib/format";

export function ExpensesPage() {
  const { getByType, personnelMonthlyTotal } = useFinancial();
  const records = getByType("expense");
  const otherTotal = records.reduce((sum, r) => sum + r.amount, 0);
  const grandTotal = otherTotal + personnelMonthlyTotal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">비용</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          고정 인건비와 기타 비용을 나누어 관리합니다. 대시보드에 모두 반영됩니다.
        </p>
      </div>

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
              기타 비용 합계
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(otherTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{records.length}건</p>
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

      <PersonnelSection />

      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">기타 비용</CardTitle>
          <p className="text-sm text-muted-foreground">
            비용 항목과 금액을 입력한 뒤 저장하세요. + 로 행을 추가할 수 있습니다.
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <OtherExpensesEditor records={records} />
        </CardContent>
      </Card>
    </div>
  );
}
