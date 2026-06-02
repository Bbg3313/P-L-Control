"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoExchangeRate } from "@/hooks/use-auto-exchange-rate";
import { parseAmountInput } from "@/lib/calculations";
import { formatAmountInputValue, formatCurrency } from "@/lib/format";
import {
  calcOverseasMonthlyKrw,
  formatForeignAmount,
  getOverseasCurrencyLabel,
  type OverseasCurrency,
} from "@/lib/overseas-fx";
import type { PersonnelEntry } from "@/lib/personnel";

/** 연봉·월급 입력 — 고정 폭 */
export const SALARY_INPUT_CLASS =
  "h-8 w-[5.25rem] shrink-0 tabular-nums px-1.5 text-sm";

interface OverseasSalaryCellProps {
  entry: PersonnelEntry;
  currency: OverseasCurrency;
  onUpdate: (patch: Partial<PersonnelEntry>) => void;
}

/** 테이블 셀용 — 월급 입력만 */
export function OverseasSalaryCell({
  entry,
  currency,
  onUpdate,
}: OverseasSalaryCellProps) {
  const currencyLabel = getOverseasCurrencyLabel(currency);
  const amount =
    entry.inputMode === "direct"
      ? entry.directMonthlyAmount
      : entry.salaryAmount;

  return (
    <Input
      inputMode="numeric"
      placeholder={currency === "THB" ? "바트" : "동"}
      className={SALARY_INPUT_CLASS}
      aria-label={`${entry.name} 월급 (${currencyLabel})`}
      value={formatAmountInputValue(amount)}
      onChange={(e) => {
        const next = parseAmountInput(e.target.value);
        if (entry.inputMode === "direct") {
          onUpdate({ directMonthlyAmount: next });
        } else {
          onUpdate({
            salaryAmount: next,
            salaryBasis: "monthly",
            inputMode: "salary",
          });
        }
      }}
    />
  );
}

interface OverseasPersonnelDetailProps {
  entry: PersonnelEntry;
  currency: OverseasCurrency;
  onUpdate: (patch: Partial<PersonnelEntry>) => void;
}

/** 펼침 상세 — 환율·환산 */
export function OverseasPersonnelDetail({
  entry,
  currency,
  onUpdate,
}: OverseasPersonnelDetailProps) {
  const rateDate =
    entry.exchangeRateDate || new Date().toISOString().slice(0, 10);

  const { loading, error, meta, refetch } = useAutoExchangeRate({
    currency,
    date: rateDate,
    onRate: (rate) => onUpdate({ exchangeRateToKrw: rate }),
  });

  const fx = calcOverseasMonthlyKrw({ ...entry, exchangeRateDate: rateDate });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-[8rem] flex-1 gap-1">
          <Label
            htmlFor={`${entry.id}-fx-date`}
            className="text-[11px] text-muted-foreground"
          >
            환율 기준일
          </Label>
          <Input
            id={`${entry.id}-fx-date`}
            type="date"
            className="h-8"
            value={rateDate}
            onChange={(e) => onUpdate({ exchangeRateDate: e.target.value })}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={loading}
          onClick={() => refetch()}
        >
          <RefreshCw
            className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
          />
          환율
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">
        {loading && "환율 조회 중…"}
        {error && !loading && <span className="text-destructive">{error}</span>}
        {!loading && !error && entry.exchangeRateToKrw > 0 && (
          <>
            1 {currency === "THB" ? "바트" : "동"} = ₩{" "}
            {entry.exchangeRateToKrw.toLocaleString("ko-KR", {
              maximumFractionDigits: 4,
            })}
            {meta && meta.usedDate !== meta.requestedDate && (
              <span className="ml-1">(최신 환율)</span>
            )}
          </>
        )}
        {fx && fx.foreignMonthly > 0 && fx.exchangeRateToKrw > 0 && (
          <p className="mt-1 font-medium text-foreground">
            {formatForeignAmount(fx.foreignMonthly, fx.currency)} →{" "}
            {formatCurrency(fx.monthlyKrw)}/월
          </p>
        )}
      </div>
    </div>
  );
}
