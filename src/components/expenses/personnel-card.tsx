"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { parseAmountInput } from "@/lib/calculations";
import { formatAmountInputValue, formatCurrency } from "@/lib/format";
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
import { cn } from "@/lib/utils";
import {
  OverseasPersonnelDetail,
  OverseasSalaryCell,
  SALARY_INPUT_CLASS,
} from "./overseas-personnel-fields";

function PersonnelBadges({ entry }: { entry: PersonnelEntry }) {
  const overseas = isOverseasTeam(entry.name);
  const youth = isYouthIncomeTaxReliefEligible(entry.name);
  const nonTaxable = getMonthlyNonTaxableAllowance(entry.name);

  if (!overseas && !youth && nonTaxable < 400_000) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {overseas && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
          해외
        </span>
      )}
      {youth && (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200/60">
          청년감면
        </span>
      )}
      {nonTaxable >= 400_000 && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200/60">
          비과세 40만
        </span>
      )}
    </div>
  );
}

function InsuranceBreakdownDetail({
  breakdown,
}: {
  breakdown: NonNullable<
    ReturnType<typeof getPersonnelSalaryBreakdown>
  >["employer"];
}) {
  const items = [
    ["급여(세전)", breakdown.monthlyGross],
    ...(breakdown.nonTaxableMonthly > 0
      ? ([
          ["비과세 제외", -breakdown.nonTaxableMonthly],
          ["보수월액", breakdown.insuranceBase],
        ] as const)
      : []),
    ["국민연금", breakdown.pensionEmployer],
    ["건강보험", breakdown.healthEmployer],
    ["장기요양", breakdown.longTermCareEmployer],
    ["고용보험", breakdown.employmentEmployer],
    ["산재보험", breakdown.industrialAccidentEmployer],
  ];

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-slate-200/60"
        >
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="text-sm font-medium tabular-nums text-slate-900">
            {typeof value === "number" && value < 0
              ? `−${formatCurrency(Math.abs(value))}`
              : formatCurrency(value as number)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface PersonnelCardProps {
  entry: PersonnelEntry;
  onUpdate: (patch: Partial<PersonnelEntry>) => void;
}

export function PersonnelCard({ entry, onUpdate }: PersonnelCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const overseas = isOverseasTeam(entry.name);
  const overseasCurrency = overseas ? getOverseasCurrency(entry.name) : null;
  const monthlyCost = getPersonnelMonthlyCost(entry);
  const salaryBreakdown = getPersonnelSalaryBreakdown(entry);
  const breakdown = salaryBreakdown?.employer ?? null;
  const taxRelief = salaryBreakdown?.youthTaxRelief ?? null;
  const employerInsurance = breakdown?.totalEmployerContributions ?? 0;

  const hasInsuranceDetail = breakdown != null && breakdown.monthlyGross > 0;
  const hasTaxDetail =
    taxRelief != null && taxRelief.incomeTaxBeforeRelief > 0;
  const hasOverseasDetail = overseas && overseasCurrency != null;
  const hasDetail = hasInsuranceDetail || hasTaxDetail || hasOverseasDetail;

  const detailLabel = overseas ? "환율·환산 상세" : "4대보험 상세";
  const salaryLabel = overseas ? "월급" : entry.inputMode === "direct" ? "월비용" : "연봉";

  return (
    <article className="min-w-0 w-full rounded-xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.03] transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight text-slate-900">
            {entry.name}
          </h3>
          <PersonnelBadges entry={entry} />
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            월 비용
          </p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 sm:text-lg">
            {monthlyCost > 0 ? formatCurrency(monthlyCost) : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5 sm:flex-1">
          <span className="w-11 shrink-0 text-xs font-medium text-slate-500">
            {salaryLabel}
          </span>
          {overseas && overseasCurrency ? (
            <OverseasSalaryCell
              entry={entry}
              currency={overseasCurrency}
              onUpdate={onUpdate}
            />
          ) : entry.inputMode === "direct" ? (
            <Input
              inputMode="numeric"
              placeholder="월"
              className={SALARY_INPUT_CLASS}
              aria-label={`${entry.name} 월 비용`}
              value={formatAmountInputValue(entry.directMonthlyAmount)}
              onChange={(e) =>
                onUpdate({
                  directMonthlyAmount: parseAmountInput(e.target.value),
                })
              }
            />
          ) : (
            <Input
              inputMode="numeric"
              placeholder="연봉"
              className={SALARY_INPUT_CLASS}
              aria-label={`${entry.name} 연봉`}
              value={formatAmountInputValue(entry.salaryAmount)}
              onChange={(e) =>
                onUpdate({
                  salaryAmount: parseAmountInput(e.target.value),
                  salaryBasis: "annual",
                })
              }
            />
          )}
        </div>
        {!overseas && employerInsurance > 0 && (
          <p className="text-xs text-slate-500">
            회사 부담{" "}
            <span className="font-semibold tabular-nums text-slate-700">
              {formatCurrency(employerInsurance)}
            </span>
          </p>
        )}
      </div>

      {hasDetail && (
        <>
          <button
            type="button"
            className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50/80 sm:px-5"
            aria-expanded={detailOpen}
            onClick={() => setDetailOpen((prev) => !prev)}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                detailOpen && "rotate-180"
              )}
              aria-hidden
            />
            {detailLabel}
          </button>

          {detailOpen && (
            <div className="space-y-4 border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5">
              {hasOverseasDetail && overseasCurrency && (
                <OverseasPersonnelDetail
                  entry={entry}
                  currency={overseasCurrency}
                  onUpdate={onUpdate}
                />
              )}
              {hasInsuranceDetail && breakdown && (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {JUN_2026_INSURANCE_LABEL} · 회사 부담
                  </p>
                  <InsuranceBreakdownDetail breakdown={breakdown} />
                </div>
              )}
              {hasTaxDetail && taxRelief && (
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4">
                  <p className="text-xs font-semibold text-emerald-800">
                    청년 소득세 감면 (근로자 원천징수 참고)
                  </p>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        ["소득세(전)", taxRelief.incomeTaxBeforeRelief, false],
                        ["감면(90%)", taxRelief.incomeTaxRelief, true],
                        ["실수령 추정", taxRelief.estimatedNetPay, false],
                      ] as const
                    ).map(([label, value, isRelief]) => (
                      <div
                        key={label}
                        className="rounded-lg bg-white/70 px-3 py-2 ring-1 ring-emerald-200/50"
                      >
                        <dt className="text-[11px] text-emerald-700/80">
                          {label}
                        </dt>
                        <dd
                          className={cn(
                            "mt-0.5 text-sm font-semibold tabular-nums",
                            isRelief ? "text-emerald-600" : "text-slate-900"
                          )}
                        >
                          {isRelief
                            ? `−${formatCurrency(value)}`
                            : formatCurrency(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}
