"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinancial } from "@/contexts/financial-context";
import { parseAmountInput } from "@/lib/calculations";
import { formatCurrency } from "@/lib/format";
import {
  getMonthlyNonTaxableAllowance,
  getPersonnelMonthlyCost,
  getPersonnelSalaryBreakdown,
  isOverseasTeam,
  isYouthIncomeTaxReliefEligible,
  type PersonnelEntry,
} from "@/lib/personnel";
import { getOverseasCurrency } from "@/lib/overseas-fx";
import { JUN_2026_INSURANCE_LABEL } from "@/lib/social-insurance-jun-2026";
import { OverseasPersonnelFields } from "./overseas-personnel-fields";

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
  const overseasCurrency = overseas ? getOverseasCurrency(entry.name) : null;
  const youthRelief = isYouthIncomeTaxReliefEligible(entry.name);
  const nonTaxable = getMonthlyNonTaxableAllowance(entry.name);
  const monthlyCost = getPersonnelMonthlyCost(entry);
  const salaryBreakdown = getPersonnelSalaryBreakdown(entry);
  const breakdown = salaryBreakdown?.employer ?? null;
  const taxRelief = salaryBreakdown?.youthTaxRelief ?? null;

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">{entry.name}</p>
          {overseas && overseasCurrency && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              현지팀 — {overseasCurrency === "THB" ? "바트" : "동"} 입력 · 기준일
              자동 환율 조회 후 원화 환산
            </p>
          )}
          {nonTaxable > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              비과세 {formatCurrency(nonTaxable)}/월 제외 (4대보험·원천징수
              산정)
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

      {overseas && overseasCurrency ? (
        <OverseasPersonnelFields
          entry={entry}
          currency={overseasCurrency}
          onUpdate={onUpdate}
        />
      ) : (
        <>
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
          <div className="max-w-xs">
            <AmountInput
              id={`${entry.id}-salary`}
              label="연봉 (원)"
              value={entry.salaryAmount}
              onChange={(salaryAmount) =>
                onUpdate({ salaryAmount, salaryBasis: "annual" })
              }
              placeholder="예: 48000000"
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
                {breakdown.nonTaxableMonthly > 0 && (
                  <>
                    <div className="flex justify-between gap-2 sm:block">
                      <dt>비과세 제외</dt>
                      <dd className="tabular-nums text-foreground">
                        −{formatCurrency(breakdown.nonTaxableMonthly)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <dt>보수월액(산정)</dt>
                      <dd className="tabular-nums text-foreground">
                        {formatCurrency(breakdown.insuranceBase)}
                      </dd>
                    </div>
                  </>
                )}
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

        </div>
      )}
        </>
      )}
    </div>
  );
}

export function PersonnelSection() {
  const { personnel, updatePersonnel, hydrated } = useFinancial();

  const handleUpdate = useCallback(
    (id: string, patch: Partial<PersonnelEntry>) => {
      updatePersonnel(updateEntry(personnel, id, patch));
    },
    [personnel, updatePersonnel]
  );

  if (!hydrated) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        인건비 데이터를 불러오는 중…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        구성원·4대보험 구조는 고정입니다. 연봉·월급 등{" "}
        <span className="font-medium text-foreground">금액만</span> 입력하세요.{" "}
        {JUN_2026_INSURANCE_LABEL} 회사 부담분은 자동 계산됩니다.
      </p>
      {personnel.map((entry) => (
        <PersonnelRow
          key={entry.id}
          entry={entry}
          onUpdate={(patch) => handleUpdate(entry.id, patch)}
        />
      ))}
      <p className="text-xs text-muted-foreground">
        국내 직원은 비과세(기본 20만·박양근·안효재 40만)를 4대보험·원천징수
        산정에서 제외합니다. 태국·베트남 팀은 기준일 환율을 자동 조회해 원화로
        환산합니다.
      </p>
    </div>
  );
}
