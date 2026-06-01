"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoExchangeRate } from "@/hooks/use-auto-exchange-rate";
import { parseAmountInput } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import {
  calcOverseasMonthlyKrw,
  formatForeignAmount,
  getOverseasCurrencyLabel,
  type OverseasCurrency,
} from "@/lib/overseas-fx";
import type { PersonnelEntry } from "@/lib/personnel";

function AmountInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (amount: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder={placeholder ?? "0"}
        className="h-9 tabular-nums"
        value={value > 0 ? String(value) : ""}
        onChange={(e) => onChange(parseAmountInput(e.target.value))}
      />
    </div>
  );
}

interface OverseasPersonnelFieldsProps {
  entry: PersonnelEntry;
  currency: OverseasCurrency;
  onUpdate: (patch: Partial<PersonnelEntry>) => void;
}

export function OverseasPersonnelFields({
  entry,
  currency,
  onUpdate,
}: OverseasPersonnelFieldsProps) {
  const currencyLabel = getOverseasCurrencyLabel(currency);
  const rateDate = entry.exchangeRateDate || new Date().toISOString().slice(0, 10);

  const { loading, error, meta, refetch } = useAutoExchangeRate({
    currency,
    date: rateDate,
    onRate: (rate) => onUpdate({ exchangeRateToKrw: rate }),
  });

  const fx = calcOverseasMonthlyKrw({ ...entry, exchangeRateDate: rateDate });

  return (
    <div className="mt-3 space-y-3">
      <div className="max-w-xs">
        <AmountInput
          id={`${entry.id}-foreign-salary`}
          label={`월급 (${currencyLabel})`}
          value={
            entry.inputMode === "direct"
              ? entry.directMonthlyAmount
              : entry.salaryAmount
          }
          onChange={(amount) => {
            if (entry.inputMode === "direct") {
              onUpdate({ directMonthlyAmount: amount });
            } else {
              onUpdate({
                salaryAmount: amount,
                salaryBasis: "monthly",
                inputMode: "salary",
              });
            }
          }}
          placeholder={currency === "THB" ? "예: 120000" : "예: 45000000"}
        />
      </div>

      <div className="grid max-w-lg gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`${entry.id}-fx-date`} className="text-xs text-muted-foreground">
            환율 기준일
          </Label>
          <Input
            id={`${entry.id}-fx-date`}
            type="date"
            className="h-9"
            value={rateDate}
            onChange={(e) =>
              onUpdate({
                exchangeRateDate: e.target.value,
              })
            }
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={loading}
          onClick={() => refetch()}
        >
          <RefreshCw
            className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            data-icon="inline-start"
          />
          환율 조회
        </Button>
      </div>

      <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
        {loading && (
          <p className="text-muted-foreground">환율을 불러오는 중…</p>
        )}
        {error && !loading && (
          <p className="text-destructive">{error}</p>
        )}
        {!loading && !error && entry.exchangeRateToKrw > 0 && (
          <p className="text-foreground">
            <span className="text-muted-foreground">자동 환율 · </span>
            1 {currency === "THB" ? "바트" : "동"} ={" "}
            <span className="font-medium tabular-nums">
              ₩{" "}
              {entry.exchangeRateToKrw.toLocaleString("ko-KR", {
                maximumFractionDigits: 6,
              })}
            </span>
            {meta && meta.usedDate !== meta.requestedDate && (
              <span className="ml-1 text-muted-foreground">
                (미래·휴일 → 최신 환율 적용)
              </span>
            )}
          </p>
        )}
      </div>

      {fx && fx.foreignMonthly > 0 && fx.exchangeRateToKrw > 0 && (
        <div className="rounded-md border border-border/60 bg-background/80 p-3 text-xs">
          <p className="text-muted-foreground">
            {rateDate} 기준 자동 환산
          </p>
          <p className="mt-2 font-medium text-foreground">
            {formatForeignAmount(fx.foreignMonthly, fx.currency)} →{" "}
            {formatCurrency(fx.monthlyKrw)} /월
          </p>
        </div>
      )}

      {fx && fx.foreignMonthly > 0 && fx.exchangeRateToKrw <= 0 && !loading && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          환율 조회가 완료되면 원화로 환산됩니다.
        </p>
      )}
    </div>
  );
}

