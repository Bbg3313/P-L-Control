"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFinancial } from "@/contexts/financial-context";
import { formatCurrency } from "@/lib/format";
import { formatRecordDate } from "@/lib/calculations";
import type { FinancialRecord } from "@/lib/types";

interface RecordsTableProps {
  records: FinancialRecord[];
  emptyMessage: string;
}

export function RecordsTable({ records, emptyMessage }: RecordsTableProps) {
  const { removeRecord, hydrated } = useFinancial();

  if (!hydrated) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        데이터를 불러오는 중…
      </p>
    );
  }

  if (records.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>날짜</TableHead>
          <TableHead>카테고리</TableHead>
          <TableHead className="min-w-[200px]">내역</TableHead>
          <TableHead className="text-right">금액</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            <TableCell>{formatRecordDate(record.date)}</TableCell>
            <TableCell className="font-medium">{record.category}</TableCell>
            <TableCell className="whitespace-normal text-muted-foreground">
              {record.description}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatCurrency(record.amount)}
            </TableCell>
            <TableCell>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="삭제"
                onClick={() => removeRecord(record.id)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
