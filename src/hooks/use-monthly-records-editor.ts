"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFinancial } from "@/contexts/financial-context";
import { parseAmountInput } from "@/lib/calculations";
import type { FinancialRecord, TransactionType } from "@/lib/types";

export type MonthlyRecordKind = "revenue" | "expense";

export interface MonthlyEditorRow {
  key: string;
  recordId: string | null;
  primary: string;
  secondary: string;
  amount: string;
}

function emptyRow(): MonthlyEditorRow {
  return {
    key: crypto.randomUUID(),
    recordId: null,
    primary: "",
    secondary: "",
    amount: "",
  };
}

function recordToRow(
  record: FinancialRecord,
  kind: MonthlyRecordKind
): MonthlyEditorRow {
  if (kind === "revenue") {
    return {
      key: record.id,
      recordId: record.id,
      primary: record.client,
      secondary: record.category,
      amount: record.amount > 0 ? String(record.amount) : "",
    };
  }
  return {
    key: record.id,
    recordId: record.id,
    primary: record.description || record.category,
    secondary: "",
    amount: record.amount > 0 ? String(record.amount) : "",
  };
}

function recordsToRows(
  records: FinancialRecord[],
  kind: MonthlyRecordKind
): MonthlyEditorRow[] {
  return records.map((r) => recordToRow(r, kind));
}

export function useMonthlyRecordsEditor(
  kind: MonthlyRecordKind,
  records: FinancialRecord[]
) {
  const {
    reportingMonth,
    hydrated,
    addRecord,
    updateRecord,
    removeRecord,
  } = useFinancial();

  const recordType: TransactionType = kind;
  const applyDate = `${reportingMonth}-01`;

  const [editMode, setEditMode] = useState(false);
  const [rows, setRows] = useState<MonthlyEditorRow[]>([emptyRow()]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetFromRecords = useCallback(
    (list: FinancialRecord[]) => {
      const mapped = recordsToRows(list, kind);
      setRows(mapped.length > 0 ? mapped : [emptyRow()]);
      setRemovedIds([]);
    },
    [kind]
  );

  const recordsSignature = useMemo(
    () =>
      records
        .map((r) => `${r.id}|${r.date}|${r.client}|${r.category}|${r.description}|${r.amount}`)
        .join(";;"),
    [records]
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!editMode) resetFromRecords(records);
  }, [hydrated, editMode, recordsSignature, records, resetFromRecords]);

  const prevReportingMonth = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (prevReportingMonth.current === reportingMonth) return;
    prevReportingMonth.current = reportingMonth;
    resetFromRecords(records);
    setRemovedIds([]);
    setEditMode(false);
    setMessage(null);
    setError(null);
  }, [reportingMonth, hydrated, records, resetFromRecords]);

  const draftTotal = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const amount = parseAmountInput(row.amount);
        const primary = row.primary.trim();
        if (kind === "revenue") {
          const category = row.secondary.trim();
          return sum + (primary && category && amount > 0 ? amount : 0);
        }
        return sum + (primary && amount > 0 ? amount : 0);
      }, 0),
    [rows, kind]
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

  function updateRow(key: string, patch: Partial<MonthlyEditorRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  function handleSave() {
    setError(null);
    setMessage(null);

    const validRows = rows.filter((row) => {
      const primary = row.primary.trim();
      const amount = parseAmountInput(row.amount);
      if (kind === "revenue") {
        return primary && row.secondary.trim() && amount > 0;
      }
      return primary && amount > 0;
    });

    if (validRows.length === 0 && removedIds.length === 0) {
      setError(
        kind === "revenue"
          ? "저장할 매출 항목을 입력해 주세요."
          : "저장할 비용 항목을 입력해 주세요."
      );
      return;
    }

    for (const id of removedIds) {
      removeRecord(id);
    }

    let savedCount = 0;
    for (const row of validRows) {
      const primary = row.primary.trim();
      const amount = parseAmountInput(row.amount);

      if (kind === "revenue") {
        const category = row.secondary.trim();
        if (row.recordId && !removedIds.includes(row.recordId)) {
          updateRecord(row.recordId, {
            date: applyDate,
            client: primary,
            category,
            amount,
            type: recordType,
          });
          savedCount += 1;
        } else if (!row.recordId) {
          addRecord({
            date: applyDate,
            client: primary,
            category,
            amount,
            type: recordType,
          });
          savedCount += 1;
        }
      } else {
        if (row.recordId && !removedIds.includes(row.recordId)) {
          updateRecord(row.recordId, {
            date: applyDate,
            category: primary,
            description: primary,
            amount,
            type: recordType,
          });
          savedCount += 1;
        } else if (!row.recordId) {
          addRecord({
            date: applyDate,
            category: primary,
            description: primary,
            amount,
            type: recordType,
          });
          savedCount += 1;
        }
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
    if (
      rows.length === 0 ||
      (rows.length === 1 &&
        !rows[0].primary &&
        !rows[0].secondary &&
        !rows[0].amount)
    ) {
      const mapped = recordsToRows(records, kind);
      setRows(mapped.length > 0 ? mapped : [emptyRow()]);
    }
  }

  function handleCancelEdit() {
    resetFromRecords(records);
    setEditMode(false);
    setError(null);
    setMessage(null);
  }

  return {
    reportingMonth,
    hydrated,
    editMode,
    rows,
    draftTotal,
    message,
    error,
    handleAddRow,
    handleRemoveRow,
    updateRow,
    handleSave,
    handleStartEdit,
    handleCancelEdit,
    recordsCount: records.length,
  };
}
