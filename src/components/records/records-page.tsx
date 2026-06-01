"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      "인건비, 사무실비용, 광고비 등 카테고리와 금액을 직접 입력해 관리합니다.",
    emptyMessage: "등록된 비용이 없습니다. 「기록 추가」로 입력하세요.",
    totalLabel: "전체 비용 합계",
  },
} as const;

interface RecordsPageProps {
  type: TransactionType;
}

export function RecordsPage({ type }: RecordsPageProps) {
  const { getByType } = useFinancial();
  const records = getByType(type);
  const config = pageConfig[type];
  const total = records.reduce((sum, r) => sum + r.amount, 0);

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

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {config.totalLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(total)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {records.length}건
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <RecordsTable records={records} emptyMessage={config.emptyMessage} />
        </CardContent>
      </Card>
    </div>
  );
}
