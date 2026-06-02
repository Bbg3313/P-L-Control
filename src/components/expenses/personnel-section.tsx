"use client";

import { useCallback, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  OverseasPersonnelDetail,
  OverseasSalaryCell,
} from "./overseas-personnel-fields";

function updateEntry(
  personnel: PersonnelEntry[],
  id: string,
  patch: Partial<PersonnelEntry>
): PersonnelEntry[] {
  return personnel.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

function NameCell({ entry }: { entry: PersonnelEntry }) {
  const overseas = isOverseasTeam(entry.name);
  const youth = isYouthIncomeTaxReliefEligible(entry.name);
  const nonTaxable = getMonthlyNonTaxableAllowance(entry.name);

  return (
    <div className="min-w-[4.5rem]">
      <p className="font-medium text-slate-900">{entry.name}</p>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {overseas && (
          <span className="rounded bg-slate-100 px-1 py-px text-[10px] text-slate-600">
            해외
          </span>
        )}
        {youth && (
          <span className="rounded bg-emerald-50 px-1 py-px text-[10px] text-emerald-700">
            청년감면
          </span>
        )}
        {nonTaxable >= 400_000 && (
          <span className="rounded bg-blue-50 px-1 py-px text-[10px] text-blue-700">
            비과세40
          </span>
        )}
      </div>
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
      ? [
          ["비과세 제외", -breakdown.nonTaxableMonthly] as const,
          ["보수월액", breakdown.insuranceBase] as const,
        ]
      : []),
    ["국민연금", breakdown.pensionEmployer],
    ["건강보험", breakdown.healthEmployer],
    ["장기요양", breakdown.longTermCareEmployer],
    ["고용보험", breakdown.employmentEmployer],
    ["산재보험", breakdown.industrialAccidentEmployer],
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2 sm:block">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="tabular-nums text-foreground">
            {typeof value === "number" && value < 0
              ? `−${formatCurrency(Math.abs(value))}`
              : formatCurrency(value as number)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PersonnelDetailRow({
  entry,
  onUpdate,
}: {
  entry: PersonnelEntry;
  onUpdate: (patch: Partial<PersonnelEntry>) => void;
}) {
  const overseas = isOverseasTeam(entry.name);
  const overseasCurrency = overseas ? getOverseasCurrency(entry.name) : null;
  const salaryBreakdown = getPersonnelSalaryBreakdown(entry);
  const breakdown = salaryBreakdown?.employer ?? null;
  const taxRelief = salaryBreakdown?.youthTaxRelief ?? null;

  const hasDetail =
    (overseas && overseasCurrency) ||
    (breakdown && breakdown.monthlyGross > 0) ||
    (taxRelief && taxRelief.incomeTaxBeforeRelief > 0);

  if (!hasDetail) return null;

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={4} className="border-b bg-slate-50/80 px-2 py-0">
        <details className="group py-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            4대보험·환율·원천징수 상세
          </summary>
          <div className="mt-3 space-y-3 border-t border-slate-200/80 pt-3">
            {overseas && overseasCurrency && (
              <OverseasPersonnelDetail
                entry={entry}
                currency={overseasCurrency}
                onUpdate={onUpdate}
              />
            )}
            {breakdown && breakdown.monthlyGross > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-700">
                  {JUN_2026_INSURANCE_LABEL} · 회사 부담
                </p>
                <InsuranceBreakdownDetail breakdown={breakdown} />
              </div>
            )}
            {taxRelief && taxRelief.incomeTaxBeforeRelief > 0 && (
              <div className="rounded-md border border-emerald-200/70 bg-emerald-50/40 p-3 text-xs">
                <p className="font-medium text-emerald-800">
                  청년 소득세 감면 (근로자 원천징수 참고)
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">소득세(전)</dt>
                    <dd className="tabular-nums">
                      {formatCurrency(taxRelief.incomeTaxBeforeRelief)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">감면(90%)</dt>
                    <dd className="tabular-nums text-emerald-700">
                      −{formatCurrency(taxRelief.incomeTaxRelief)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">실수령 추정</dt>
                    <dd className="tabular-nums font-medium">
                      {formatCurrency(taxRelief.estimatedNetPay)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </details>
      </TableCell>
    </TableRow>
  );
}

function PersonnelDataRow({
  entry,
  onUpdate,
}: {
  entry: PersonnelEntry;
  onUpdate: (patch: Partial<PersonnelEntry>) => void;
}) {
  const overseas = isOverseasTeam(entry.name);
  const overseasCurrency = overseas ? getOverseasCurrency(entry.name) : null;
  const monthlyCost = getPersonnelMonthlyCost(entry);
  const salaryBreakdown = getPersonnelSalaryBreakdown(entry);
  const breakdown = salaryBreakdown?.employer ?? null;
  const employerInsurance = breakdown?.totalEmployerContributions ?? 0;

  return (
    <>
      <TableRow>
        <TableCell>
          <NameCell entry={entry} />
        </TableCell>
        <TableCell>
          {overseas && overseasCurrency ? (
            <OverseasSalaryCell
              entry={entry}
              currency={overseasCurrency}
              onUpdate={onUpdate}
            />
          ) : entry.inputMode === "direct" ? (
            <Input
              inputMode="numeric"
              placeholder="월 비용"
              className="h-8 w-full min-w-[7.5rem] tabular-nums"
              aria-label={`${entry.name} 월 비용`}
              value={
                entry.directMonthlyAmount > 0
                  ? String(entry.directMonthlyAmount)
                  : ""
              }
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
              className="h-8 w-full min-w-[7.5rem] tabular-nums"
              aria-label={`${entry.name} 연봉`}
              value={entry.salaryAmount > 0 ? String(entry.salaryAmount) : ""}
              onChange={(e) =>
                onUpdate({
                  salaryAmount: parseAmountInput(e.target.value),
                  salaryBasis: "annual",
                })
              }
            />
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {employerInsurance > 0 ? formatCurrency(employerInsurance) : "—"}
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums">
          {monthlyCost > 0 ? formatCurrency(monthlyCost) : "—"}
        </TableCell>
      </TableRow>
      <PersonnelDetailRow entry={entry} onUpdate={onUpdate} />
    </>
  );
}

export function PersonnelSection() {
  const { personnel, personnelMonthlyTotal, updatePersonnel, hydrated } =
    useFinancial();

  const { domestic, overseasList } = useMemo(() => {
    const domestic: PersonnelEntry[] = [];
    const overseasList: PersonnelEntry[] = [];
    for (const p of personnel) {
      if (isOverseasTeam(p.name)) overseasList.push(p);
      else domestic.push(p);
    }
    return { domestic, overseasList };
  }, [personnel]);

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

  const renderGroup = (list: PersonnelEntry[], label: string) =>
    list.length > 0 ? (
      <>
        <TableRow className="hover:bg-transparent bg-muted/30">
          <TableCell
            colSpan={4}
            className="py-1.5 text-xs font-semibold text-muted-foreground"
          >
            {label}
          </TableCell>
        </TableRow>
        {list.map((entry) => (
          <PersonnelDataRow
            key={entry.id}
            entry={entry}
            onUpdate={(patch) => handleUpdate(entry.id, patch)}
          />
        ))}
      </>
    ) : null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        연봉·월급만 입력하면 월 비용이 자동 계산됩니다. 상세는 행 아래{" "}
        <span className="font-medium text-foreground">▶ 상세</span>에서
        확인하세요.
      </p>

      <div className="overflow-hidden rounded-lg border border-border/80">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[28%]">이름</TableHead>
              <TableHead>연봉 · 월급</TableHead>
              <TableHead className="text-right">회사 보험</TableHead>
              <TableHead className="text-right">월 비용</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderGroup(domestic, `국내 ${domestic.length}명`)}
            {renderGroup(overseasList, `해외 ${overseasList.length}명`)}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-medium">
                월 합계 ({personnel.length}명)
              </TableCell>
              <TableCell className="text-right text-base font-bold tabular-nums">
                {formatCurrency(personnelMonthlyTotal)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
