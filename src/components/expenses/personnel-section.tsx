"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinancial } from "@/contexts/financial-context";
import { parseAmountInput } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import {
  getPersonnelMonthlyCost,
  getPersonnelSalaryBreakdown,
  isOverseasTeam,
  isYouthIncomeTaxReliefEligible,
  type PersonnelEntry,
} from "@/lib/personnel";
import { JUN_2026_INSURANCE_LABEL } from "@/lib/social-insurance-jun-2026";

function updateEntry(
  personnel: PersonnelEntry[],
  id: string,
  patch: Partial<PersonnelEntry>
): PersonnelEntry[] {
  return personnel.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

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

function PersonnelRow({
  entry,
  onUpdate,
}: {
  entry: PersonnelEntry;
  onUpdate: (patch: Partial<PersonnelEntry>) => void;
}) {
  const overseas = isOverseasTeam(entry.name);
  const youthRelief = isYouthIncomeTaxReliefEligible(entry.name);
  const monthlyCost = getPersonnelMonthlyCost(entry);
  const salaryBreakdown = getPersonnelSalaryBreakdown(entry);
  const breakdown = salaryBreakdown?.employer ?? null;
  const taxRelief = salaryBreakdown?.youthTaxRelief ?? null;

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">{entry.name}</p>
          {overseas && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              현지팀 — 한국 4대보험 미적용
            </p>
          )}
          {youthRelief && (
            <p className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              중소기업 청년 소득세 감면 (90%·연 200만 한도)
            </p>
          )}
        </div>
        <p className="text-lg font-semibold tabular-nums sm:text-right">
          {monthlyCost > 0 ? formatCurrency(monthlyCost) : "—"}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            /월
          </span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ModeButton
          active={entry.inputMode === "direct"}
          onClick={() => onUpdate({ inputMode: "direct" })}
        >
          금액 직접입력
        </ModeButton>
        <ModeButton
          active={entry.inputMode === "salary"}
          onClick={() => onUpdate({ inputMode: "salary" })}
        >
          급여 입력
        </ModeButton>
      </div>

      {entry.inputMode === "direct" ? (
        <div className="mt-3 max-w-xs">
          <AmountInput
            id={`${entry.id}-direct`}
            label="월 비용 (원)"
            value={entry.directMonthlyAmount}
            onChange={(directMonthlyAmount) => onUpdate({ directMonthlyAmount })}
            placeholder="예: 3500000"
          />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <BasisButton
              active={entry.salaryBasis === "monthly"}
              onClick={() => onUpdate({ salaryBasis: "monthly" })}
            >
              월급
            </BasisButton>
            <BasisButton
              active={entry.salaryBasis === "annual"}
              onClick={() => onUpdate({ salaryBasis: "annual" })}
            >
              연봉
            </BasisButton>
          </div>
          <div className="max-w-xs">
            <AmountInput
              id={`${entry.id}-salary`}
              label={entry.salaryBasis === "annual" ? "연봉 (원)" : "월급 (원)"}
              value={entry.salaryAmount}
              onChange={(salaryAmount) => onUpdate({ salaryAmount })}
              placeholder={
                entry.salaryBasis === "annual" ? "예: 48000000" : "예: 4000000"
              }
            />
          </div>

          {breakdown && breakdown.monthlyGross > 0 && (
            <div className="rounded-md border border-border/60 bg-background/80 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                {JUN_2026_INSURANCE_LABEL} · 회사 부담 포함
              </p>
              <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt>급여(세전)</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(breakdown.monthlyGross)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt>국민연금</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(breakdown.pensionEmployer)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt>건강보험</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(breakdown.healthEmployer)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt>장기요양</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(breakdown.longTermCareEmployer)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt>고용보험</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(breakdown.employmentEmployer)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt>산재보험</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(breakdown.industrialAccidentEmployer)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 border-t border-border/60 pt-2">
                회사 부담 보험료 합계{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(breakdown.totalEmployerContributions)}
                </span>
                {" · "}
                월 총 인건비(비용){" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(breakdown.totalMonthlyEmployerCost)}
                </span>
              </p>
            </div>
          )}

          {taxRelief && taxRelief.incomeTaxBeforeRelief > 0 && (
            <div className="rounded-md border border-emerald-200/80 bg-emerald-50/50 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">
                청년 소득세 감면 · 근로자 원천징수 (참고)
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                아래 소득세·지방소득세는 급여에서 공제하는 근로자 부담이며, 회사
                인건비(비용)에는 포함되지 않습니다.
              </p>
              <dl className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
                <div className="flex justify-between gap-2 sm:block">
                  <dt>근로자 소득세(감면 전)</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(taxRelief.incomeTaxBeforeRelief)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt>소득세 감면(90%)</dt>
                  <dd className="tabular-nums text-emerald-700 dark:text-emerald-400">
                    −{formatCurrency(taxRelief.incomeTaxRelief)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt>근로자 소득세(감면 후)</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(taxRelief.incomeTaxAfterRelief)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:block">
                  <dt>근로자 지방소득세(감면 후)</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatCurrency(taxRelief.localIncomeTaxAfterRelief)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 border-t border-emerald-200/60 pt-2 text-muted-foreground dark:border-emerald-900/50">
                근로자 실수령 추정{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(taxRelief.estimatedNetPay)}
                </span>
                <span className="mt-1 block text-[11px]">
                  회사는 원천징수만 대행 납부하며, 지방소득세는 사업주 추가
                  부담이 아닙니다. 인건비(비용) = 세전 급여 + 회사 4대보험입니다.
                </span>
              </p>
            </div>
          )}

          {overseas && entry.salaryAmount > 0 && (
            <p className="text-xs text-muted-foreground">
              현지팀은 입력 급여를 월 환산 금액으로만 반영합니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function BasisButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60"
      }`}
    >
      {children}
    </button>
  );
}

export function PersonnelSection() {
  const { personnel, personnelMonthlyTotal, updatePersonnel, hydrated } =
    useFinancial();

  const handleUpdate = useCallback(
    (id: string, patch: Partial<PersonnelEntry>) => {
      updatePersonnel(updateEntry(personnel, id, patch));
    },
    [personnel, updatePersonnel]
  );

  if (!hydrated) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          인건비 데이터를 불러오는 중…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>인건비 (고정)</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              구성원별 월 비용을 입력하세요. 국내 직원은 월급·연봉 입력 시{" "}
              {JUN_2026_INSURANCE_LABEL} 4대보험 회사 부담분이 자동 반영됩니다.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">인건비 월 합계</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatCurrency(personnelMonthlyTotal)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {personnel.map((entry) => (
          <PersonnelRow
            key={entry.id}
            entry={entry}
            onUpdate={(patch) => handleUpdate(entry.id, patch)}
          />
        ))}
        <p className="text-xs text-muted-foreground">
          고용안정·직능개발 0.25%(150인 미만), 산재보험 업종+출퇴근·임금채권
          합산 약 2.0‰ 기준입니다. 업종이 다르면 금액 직접입력을 사용하세요.
        </p>
      </CardContent>
    </Card>
  );
}
