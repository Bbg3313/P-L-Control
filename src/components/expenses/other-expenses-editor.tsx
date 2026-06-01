"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Pencil, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinancial } from "@/contexts/financial-context";
import { parseAmountInput } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import type { FinancialRecord } from "@/lib/types";

interface ExpenseRow {
  key: string;
  recordId: string | null;
  label: string;
  amount: string;
}

function emptyRow(): ExpenseRow {
  return {
    key: crypto.randomUUID(),
    recordId: null,
    label: "",
    amount: "",
  };
}

function recordsToRows(records: FinancialRecord[]): ExpenseRow[] {
  return records.map((r) => ({
    key: r.id,
    recordId: r.id,
    label: r.description || r.category,
    amount: r.amount > 0 ? String(r.amount) : "",
  }));
}

interface OtherExpensesEditorProps {
  records: FinancialRecord[];
}

export function OtherExpensesEditor({ records }: OtherExpensesEditorProps) {
  const {
    reportingMonth,
    hydrated,
    addRecord,
    updateRecord,
    removeRecord,
  } = useFinancial();

  const [applyMonth, setApplyMonth] = useState(reportingMonth);
  const [editMode, setEditMode] = useState(false);
  const [rows, setRows] = useState<ExpenseRow[]>([emptyRow()]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyDate = `${applyMonth}-01`;

  const resetFromRecords = useCallback((list: FinancialRecord[]) => {
    const mapped = recordsToRows(list);
    setRows(mapped.length > 0 ? mapped : [emptyRow()]);
    setRemovedIds([]);
  }, []);

  const recordsSignature = useMemo(
    () =>
      records
        .map((r) => `${r.id}|${r.date}|${r.description}|${r.amount}`)
        .join(";;"),
    [records]
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!editMode) resetFromRecords(records);
  }, [hydrated, editMode, recordsSignature, records, resetFromRecords]);

  const draftTotal = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const amount = parseAmountInput(row.amount);
        return sum + (row.label.trim() && amount > 0 ? amount : 0);
      }, 0),
    [rows]
  );

  function handleAddRow() {
    if (!editMode) setEditMode(true);
    setRows((prev) => [...prev, emptyRow()]);
  }

  function handleRemoveRow(key: string, recordId: string | null) {
    if (recordId) {
      setRemovedIds((prev) =>
        prev.includes(recordId) ? prev : [...prev, recordId]
      );
    }
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length > 0 ? next : [emptyRow()];
    });
  }

  function updateRow(key: string, patch: Partial<ExpenseRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  function handleSave() {
    setError(null);
    setMessage(null);

    const validRows = rows.filter((row) => {
      const label = row.label.trim();
      const amount = parseAmountInput(row.amount);
      return label && amount > 0;
    });

    if (validRows.length === 0 && removedIds.length === 0) {
      setError("저장할 비용 항목을 입력해 주세요.");
      return;
    }

    for (const id of removedIds) {
      removeRecord(id);
    }

    let savedCount = 0;
    for (const row of validRows) {
      const label = row.label.trim();
      const amount = parseAmountInput(row.amount);

      if (row.recordId && !removedIds.includes(row.recordId)) {
        updateRecord(row.recordId, {
          date: applyDate,
          category: label,
          description: label,
          amount,
          type: "expense",
        });
        savedCount += 1;
      } else if (!row.recordId) {
        addRecord({
          date: applyDate,
          category: label,
          description: label,
          amount,
          type: "expense",
        });
        savedCount += 1;
      }
    }

    setRemovedIds([]);
    setEditMode(false);
    setMessage(
      removedIds.length > 0
        ? `${savedCount}건 저장, ${removedIds.length}건 삭제했습니다.`
        : `${savedCount}건 저장했습니다.`
    );
  }

  function handleStartEdit() {
    setEditMode(true);
    setMessage(null);
    setError(null);
    if (rows.length === 0 || (rows.length === 1 && !rows[0].label && !rows[0].amount)) {
      setRows(recordsToRows(records).length > 0 ? recordsToRows(records) : [emptyRow()]);
    }
  }

  function handleCancelEdit() {
    resetFromRecords(records);
    setEditMode(false);
    setError(null);
    setMessage(null);
  }

  if (!hydrated) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        기타 비용을 불러오는 중…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid max-w-xs gap-1.5">
          <Label htmlFor="expense-apply-month" className="text-xs text-muted-foreground">
            적용 월
          </Label>
          <Input
            id="expense-apply-month"
            type="month"
            className="h-9"
            value={applyMonth}
            disabled={!editMode}
            onChange={(e) => setApplyMonth(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {!editMode ? (
            <Button type="button" variant="outline" onClick={handleStartEdit}>
              <Pencil data-icon="inline-start" />
              수정
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleCancelEdit}>
                취소
              </Button>
              <Button type="button" onClick={handleSave}>
                <Save data-icon="inline-start" />
                저장
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_140px_40px]">
          <span>비용</span>
          <span>금액 (원)</span>
          <span />
        </div>

        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-2 sm:grid-cols-[1fr_140px_40px] sm:items-center"
          >
            <Input
              placeholder="예: 사무실비용, 광고비"
              className="h-9"
              disabled={!editMode}
              value={row.label}
              onChange={(e) => updateRow(row.key, { label: e.target.value })}
            />
            <Input
              inputMode="numeric"
              placeholder="0"
              className="h-9 tabular-nums"
              disabled={!editMode}
              value={row.amount}
              onChange={(e) => updateRow(row.key, { amount: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="justify-self-end sm:justify-self-center"
              disabled={!editMode}
              aria-label="행 삭제"
              onClick={() => handleRemoveRow(row.key, row.recordId)}
            >
              <Minus className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={handleAddRow}
        >
          <Plus data-icon="inline-start" />
          항목 추가
        </Button>
      </div>

      <div className="flex flex-col gap-1 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          입력 합계{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(draftTotal)}
          </span>
          {!editMode && records.length > 0 && (
            <span className="ml-2">· 저장 {records.length}건</span>
          )}
        </p>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {message && !error && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
        )}
      </div>
    </div>
  );
}
