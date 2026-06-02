"use client";

import { Minus, Pencil, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REVENUE_CATEGORY_SUGGESTIONS } from "@/lib/category-suggestions";
import { formatPeriodLabel } from "@/lib/calculations";
import { formatCurrency, normalizeAmountInputString } from "@/lib/format";
import {
  useMonthlyRecordsEditor,
  type MonthlyRecordKind,
  type MonthlyRecordsEditorOptions,
} from "@/hooks/use-monthly-records-editor";
import type { FinancialRecord } from "@/lib/types";

interface MonthlyRecordsEditorProps {
  kind: MonthlyRecordKind;
  records: FinancialRecord[];
  editorOptions?: MonthlyRecordsEditorOptions;
  showRecordMonth?: boolean;
}

const CONFIG: Record<
  MonthlyRecordKind,
  {
    primaryLabel: string;
    primaryPlaceholder: string;
    secondaryLabel?: string;
    secondaryPlaceholder?: string;
    gridClass: string;
    gridClassWithMonth: string;
  }
> = {
  revenue: {
    primaryLabel: "매출처",
    primaryPlaceholder: "예: OO브랜드",
    secondaryLabel: "카테고리",
    secondaryPlaceholder: "예: 대행 수수료",
    gridClass:
      "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.5rem_minmax(8rem,1fr)_2.5rem]",
    gridClassWithMonth:
      "grid-cols-1 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_5.5rem_minmax(9rem,1fr)_2.5rem]",
  },
  expense: {
    primaryLabel: "비용 항목",
    primaryPlaceholder: "예: 사무실비, 광고비",
    gridClass:
      "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(8rem,1fr)_2.5rem]",
    gridClassWithMonth:
      "grid-cols-1 sm:grid-cols-[7rem_minmax(0,1fr)_5.5rem_minmax(9rem,1fr)_2.5rem]",
  },
};

export function MonthlyRecordsEditor({
  kind,
  records,
  editorOptions,
  showRecordMonth = false,
}: MonthlyRecordsEditorProps) {
  const config = CONFIG[kind];
  const gridClass = showRecordMonth ? config.gridClassWithMonth : config.gridClass;
  const {
    reportingMonth,
    hydrated,
    editMode,
    rows,
    draftTotal,
    draftVatSummary,
    defaultAmountIncludesVat,
    setDefaultAmountIncludesVat,
    message,
    error,
    handleAddRow,
    handleRemoveRow,
    updateRow,
    handleSave,
    handleStartEdit,
    handleCancelEdit,
    recordsCount,
  } = useMonthlyRecordsEditor(kind, records, editorOptions);

  if (!hydrated) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        데이터를 불러오는 중…
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {showRecordMonth ? (
            <>
              전체 내역 표시 · 신규 항목만{" "}
              <span className="font-medium text-foreground">
                {formatPeriodLabel(reportingMonth)}
              </span>
              에 저장
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">
                {formatPeriodLabel(reportingMonth)}
              </span>
              에 등록 · 상단 ◀ ▶ 로 월을 바꾼 뒤 저장
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {!editMode ? (
            <Button type="button" variant="outline" onClick={handleStartEdit}>
              <Pencil data-icon="inline-start" />
              {recordsCount > 0 ? "수정" : "등록"}
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

      {editMode && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">신규 항목:</span>
          <Button
            type="button"
            variant={defaultAmountIncludesVat ? "outline" : "default"}
            size="sm"
            onClick={() => setDefaultAmountIncludesVat(false)}
          >
            무자료
          </Button>
          <Button
            type="button"
            variant={defaultAmountIncludesVat ? "default" : "outline"}
            size="sm"
            onClick={() => setDefaultAmountIncludesVat(true)}
          >
            계산서 발행
          </Button>
        </div>
      )}

      <div className="min-w-0 space-y-2">
        <div
          className={`hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid ${gridClass}`}
        >
          {showRecordMonth && (
            <span className="whitespace-nowrap">적용 월</span>
          )}
          <span>{config.primaryLabel}</span>
          {kind === "revenue" && <span>{config.secondaryLabel}</span>}
          <span className="whitespace-nowrap">구분</span>
          <span>금액 (원)</span>
          <span />
        </div>

        {rows.map((row) => (
          <div
            key={row.key}
            className={`grid min-w-0 gap-2 sm:items-center ${gridClass}`}
          >
            {showRecordMonth && (
              <span className="whitespace-nowrap px-1 text-xs text-muted-foreground sm:text-sm">
                {row.recordDate
                  ? formatPeriodLabel(row.recordDate.slice(0, 7))
                  : formatPeriodLabel(reportingMonth)}
              </span>
            )}
            <Input
              placeholder={config.primaryPlaceholder}
              className="h-9 min-w-0"
              disabled={!editMode}
              value={row.primary}
              onChange={(e) => updateRow(row.key, { primary: e.target.value })}
            />
            {kind === "revenue" && (
              <>
                <Input
                  placeholder={config.secondaryPlaceholder}
                  className="h-9 min-w-0"
                  disabled={!editMode}
                  list="revenue-category-suggestions"
                  value={row.secondary}
                  onChange={(e) =>
                    updateRow(row.key, { secondary: e.target.value })
                  }
                />
                <datalist id="revenue-category-suggestions">
                  {REVENUE_CATEGORY_SUGGESTIONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </>
            )}
            <select
              className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!editMode}
              aria-label="과세 구분"
              value={row.amountIncludesVat ? "invoice" : "taxfree"}
              onChange={(e) =>
                updateRow(row.key, {
                  amountIncludesVat: e.target.value === "invoice",
                })
              }
            >
              <option value="taxfree">무자료</option>
              <option value="invoice">계산서</option>
            </select>
            <Input
              inputMode="numeric"
              placeholder="0"
              className="h-9 min-w-0 tabular-nums"
              disabled={!editMode}
              value={row.amount}
              onChange={(e) =>
                updateRow(row.key, {
                  amount: normalizeAmountInputString(e.target.value),
                })
              }
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
          disabled={!editMode}
          onClick={handleAddRow}
        >
          <Plus data-icon="inline-start" />
          항목 추가
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {showRecordMonth ? "목록 합계" : formatPeriodLabel(reportingMonth)} ·{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(draftTotal)}
              </span>
              <span className="ml-1 text-xs">
                ({kind === "revenue" ? "매출" : "비용"})
              </span>
              {!editMode && recordsCount > 0 && (
                <span className="ml-2">· 저장 {recordsCount}건</span>
              )}
            </p>
            {draftVatSummary && draftVatSummary.vatTotal > 0 && (
              <p className="text-xs text-muted-foreground">
                계산서 {draftVatSummary.vatIncludedCount}건 ·{" "}
                {kind === "revenue" ? "매출" : "매입"}세액{" "}
                {formatCurrency(draftVatSummary.vatTotal)}
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {message && !error && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
