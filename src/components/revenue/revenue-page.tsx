"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinancial } from "@/contexts/financial-context";
import { formatCurrency } from "@/lib/format";
import { AddRevenueDialog } from "./add-revenue-dialog";
import { ImportRevenueDialog } from "./import-revenue-dialog";
import { RevenueTable } from "./revenue-table";

export function RevenuePage() {
  const { getByType } = useFinancial();
  const records = getByType("revenue");
  const total = records.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">매출</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            월말 엑셀(날짜·매출처·카테고리·금액)을 가져오거나 건별로 입력합니다.
            브라우저에 저장됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportRevenueDialog />
          <AddRevenueDialog />
        </div>
      </div>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            전체 매출 합계
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(total)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{records.length}건</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">매출 내역</CardTitle>
          <p className="text-sm text-muted-foreground">
            엑셀 첫 행: 날짜 · 매출처 · 카테고리 · 금액
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <RevenueTable
            records={records}
            emptyMessage="등록된 매출이 없습니다. 엑셀 가져오기 또는 매출 추가를 이용하세요."
          />
        </CardContent>
      </Card>
    </div>
  );
}
