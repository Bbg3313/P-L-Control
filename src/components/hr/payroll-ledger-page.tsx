"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileDown,
  Landmark,
  PiggyBank,
  RotateCcw,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatPeriodLabel } from "@/lib/calculations";
import { formatAmountInputValue, formatCurrency, formatNumber } from "@/lib/format";
import type { HrEmployeeRecord } from "@/lib/hr-records-types";
import { downloadPayrollLedgerExcel } from "@/lib/payroll-export";
import { downloadPayrollPayslipExcel } from "@/lib/payroll-payslip-export";
import {
  buildPayrollLedger,
  getBasicPay,
  getTotalGrossPay,
  JUN_2026_INSURANCE_LABEL,
  PAYROLL_COMPANY_OPTIONS,
  type PayrollCompanyId,
  type PayrollLedgerResult,
  type PayrollLedgerRow,
  type PayrollLedgerSummary,
} from "@/lib/payroll-ledger";
import {
  loadPayrollTaxableOverrides,
  savePayrollTaxableOverrides,
  setTaxableOverride,
  type PayrollTaxableOverrides,
} from "@/lib/payroll-ledger-store";
import { cn } from "@/lib/utils";

function parseAmount(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card className="border-slate-200/90 shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            tone
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MoneyCell({
  value,
  emphasis,
}: {
  value: number;
  emphasis?: "indigo" | "rose";
}) {
  return (
    <span
      className={cn(
        "block text-right text-sm tabular-nums text-slate-800",
        emphasis === "indigo" && "font-semibold text-indigo-700",
        emphasis === "rose" && "font-semibold text-rose-700"
      )}
    >
      {formatNumber(value)}
    </span>
  );
}

function TaxableBaseInput({
  row,
  onChange,
  onReset,
}: {
  row: PayrollLedgerRow;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(formatAmountInputValue(row.taxableBase));

  useEffect(() => {
    setDraft(formatAmountInputValue(row.taxableBase));
  }, [row.taxableBase]);

  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        value={draft}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          setDraft(digits ? formatNumber(Number(digits)) : "");
        }}
        onBlur={() => {
          const next = parseAmount(draft);
          onChange(next);
          setDraft(formatAmountInputValue(next));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={cn(
          "h-8 w-[7.5rem] text-right text-sm tabular-nums",
          row.taxableBaseOverridden &&
            "border-amber-400 bg-amber-50 ring-1 ring-amber-200"
        )}
        aria-label={`${row.name} 과세표준`}
      />
      {row.taxableBaseOverridden && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          onClick={onReset}
          title="기본값 복원"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function PayrollTable({
  rows,
  ledger,
  summary,
  reportingMonth,
  showTaxableInput,
  onTaxableChange,
  onTaxableReset,
}: {
  rows: PayrollLedgerRow[];
  ledger: PayrollLedgerResult;
  summary: PayrollLedgerSummary;
  reportingMonth: string;
  showTaxableInput: boolean;
  onTaxableChange: (id: string, value: number) => void;
  onTaxableReset: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        표시할 인원이 없습니다.
      </p>
    );
  }

  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
          <TableHead className="w-16 text-center">구분번호</TableHead>
          <TableHead className="min-w-[5rem] text-center">성명</TableHead>
          <TableHead className="text-right">기본급</TableHead>
          <TableHead className="text-right">비과세</TableHead>
          <TableHead className="text-right">총지급액</TableHead>
          <TableHead className="min-w-[8.5rem] text-right">과세표준</TableHead>
          <TableHead className="text-right">4대보험(본인)</TableHead>
          <TableHead className="text-right">소득세</TableHead>
          <TableHead className="text-right">지방세</TableHead>
          <TableHead className="text-right">실지급</TableHead>
          <TableHead className="text-right">4대보험(회사)</TableHead>
          <TableHead className="text-right">총인건비</TableHead>
          <TableHead className="min-w-[7rem] text-center">비고</TableHead>
          <TableHead className="min-w-[5rem] text-center">명세서</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.id}>
            <TableCell className="text-center tabular-nums text-slate-600">
              {index + 1}
            </TableCell>
            <TableCell className="text-center font-medium text-slate-900">
              <div>{row.name}</div>
              {row.department && (
                <div className="text-xs font-normal text-muted-foreground">
                  {row.department}
                </div>
              )}
            </TableCell>
            <TableCell>
              <MoneyCell value={getBasicPay(row)} />
            </TableCell>
            <TableCell>
              <MoneyCell value={row.nonTaxable} />
            </TableCell>
            <TableCell>
              <MoneyCell value={getTotalGrossPay(row)} />
            </TableCell>
            <TableCell>
              {showTaxableInput ? (
                <TaxableBaseInput
                  row={row}
                  onChange={(value) => onTaxableChange(row.id, value)}
                  onReset={() => onTaxableReset(row.id)}
                />
              ) : (
                <MoneyCell value={row.taxableBase} />
              )}
            </TableCell>
            <TableCell>
              <MoneyCell value={row.employeeInsuranceTotal} />
            </TableCell>
            <TableCell>
              <div className="text-right">
                <MoneyCell value={row.incomeTax} />
                {row.incomeTaxRelief > 0 && (
                  <p className="text-[11px] text-emerald-600">
                    감면 −{formatNumber(row.incomeTaxRelief)}
                  </p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <MoneyCell value={row.localIncomeTax} />
            </TableCell>
            <TableCell>
              <MoneyCell value={row.netPay} emphasis="indigo" />
            </TableCell>
            <TableCell>
              <MoneyCell value={row.employerInsuranceTotal} />
            </TableCell>
            <TableCell>
              <MoneyCell value={row.totalEmployerCost} emphasis="rose" />
            </TableCell>
            <TableCell className="text-center text-xs text-muted-foreground">
              {row.note || "—"}
            </TableCell>
            <TableCell className="text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs"
                onClick={() =>
                  downloadPayrollPayslipExcel(ledger, row, index + 1)
                }
              >
                <FileDown className="h-3.5 w-3.5" />
                명세서
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter className="bg-slate-50/90 text-sm">
        <TableRow className="hover:bg-slate-50/90">
          <TableCell colSpan={2} className="text-center font-semibold text-slate-900">
            합계
          </TableCell>
          <TableCell>
            <MoneyCell value={summary.basicPayTotal} />
          </TableCell>
          <TableCell>
            <MoneyCell value={summary.nonTaxableTotal} />
          </TableCell>
          <TableCell>
            <MoneyCell value={summary.grossTotal} />
          </TableCell>
          <TableCell>
            <MoneyCell value={summary.taxableBaseTotal} />
          </TableCell>
          <TableCell>
            <MoneyCell value={summary.employeeInsuranceTotal} />
          </TableCell>
          <TableCell>
            <div className="text-right">
              <MoneyCell value={summary.incomeTaxTotal} />
              {summary.incomeTaxReliefTotal > 0 && (
                <p className="text-[11px] text-emerald-600">
                  감면 −{formatNumber(summary.incomeTaxReliefTotal)}
                </p>
              )}
            </div>
          </TableCell>
          <TableCell>
            <MoneyCell value={summary.localIncomeTaxTotal} />
          </TableCell>
          <TableCell>
            <MoneyCell value={summary.netPayTotal} emphasis="indigo" />
          </TableCell>
          <TableCell>
            <MoneyCell value={summary.employerInsuranceTotal} />
          </TableCell>
          <TableCell>
            <MoneyCell value={summary.totalEmployerCost} emphasis="rose" />
          </TableCell>
          <TableCell className="text-center text-xs text-muted-foreground">
            {formatPeriodLabel(reportingMonth)}
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function PayrollLedgerPage() {
  const { personnel, reportingMonth, hydrated } = useFinancial();
  const [companyId, setCompanyId] = useState<PayrollCompanyId>("bluebridge");
  const [overrides, setOverrides] = useState<PayrollTaxableOverrides>({});
  const [overridesReady, setOverridesReady] = useState(false);
  const [hrRecords, setHrRecords] = useState<HrEmployeeRecord[]>([]);

  useEffect(() => {
    setOverrides(loadPayrollTaxableOverrides());
    setOverridesReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadHr() {
      try {
        const res = await fetch("/api/hr-records");
        if (!res.ok) return;
        const data = (await res.json()) as HrEmployeeRecord[];
        if (!cancelled && Array.isArray(data)) setHrRecords(data);
      } catch {
        /* ignore */
      }
    }
    loadHr();
    return () => {
      cancelled = true;
    };
  }, []);

  const hrByName = useMemo(() => {
    const map: Record<string, { department: string; position: string }> = {};
    for (const record of hrRecords) {
      map[record.name] = {
        department: record.department,
        position: record.position,
      };
    }
    return map;
  }, [hrRecords]);

  const monthOverrides = useMemo(
    () => overrides[reportingMonth] ?? {},
    [overrides, reportingMonth]
  );

  const ledger = useMemo(
    () =>
      buildPayrollLedger(
        reportingMonth,
        personnel,
        monthOverrides,
        hrByName,
        companyId
      ),
    [reportingMonth, personnel, monthOverrides, hrByName, companyId]
  );

  const activeCompany =
    PAYROLL_COMPANY_OPTIONS.find((c) => c.id === companyId) ??
    PAYROLL_COMPANY_OPTIONS[0];

  const persistOverrides = useCallback((next: PayrollTaxableOverrides) => {
    setOverrides(next);
    savePayrollTaxableOverrides(next);
  }, []);

  const handleTaxableChange = useCallback(
    (personId: string, value: number) => {
      const next = setTaxableOverride(
        overrides,
        reportingMonth,
        personId,
        value
      );
      persistOverrides(next);
    },
    [overrides, reportingMonth, persistOverrides]
  );

  const handleTaxableReset = useCallback(
    (personId: string) => {
      const next = setTaxableOverride(
        overrides,
        reportingMonth,
        personId,
        null
      );
      persistOverrides(next);
    },
    [overrides, reportingMonth, persistOverrides]
  );

  const handleDownload = useCallback(() => {
    downloadPayrollLedgerExcel(ledger);
  }, [ledger]);

  if (!hydrated || !overridesReady) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        급여대장을 불러오는 중…
      </div>
    );
  }

  const { summary } = ledger;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <header className="sticky top-0 z-30 w-full max-w-full shrink-0 border-b border-slate-200/80 bg-slate-50/95 pb-4 shadow-sm backdrop-blur-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">급여대장</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              비용 인건비 기준 · {JUN_2026_INSURANCE_LABEL} · 과세표준 셀 직접
              수정 가능
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <ReportingMonthNav className="w-full sm:w-auto" />
            <Button type="button" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              엑셀 다운로드
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={`${formatPeriodLabel(reportingMonth)} 총 지급액`}
            value={formatCurrency(summary.grossTotal)}
            sub={`${summary.domesticCount}명`}
            icon={Wallet}
            tone="bg-indigo-100 text-indigo-600"
          />
          <KpiCard
            label="실지급 합계"
            value={formatCurrency(summary.netPayTotal)}
            sub={`공제합계 ${formatCurrency(summary.totalDeductions)}`}
            icon={PiggyBank}
            tone="bg-emerald-100 text-emerald-600"
          />
          <KpiCard
            label="4대보험 (본인+회사)"
            value={formatCurrency(
              summary.employeeInsuranceTotal + summary.employerInsuranceTotal
            )}
            sub={`본인 ${formatCurrency(summary.employeeInsuranceTotal)} · 회사 ${formatCurrency(summary.employerInsuranceTotal)}`}
            icon={Shield}
            tone="bg-sky-100 text-sky-600"
          />
          <KpiCard
            label="총 인건비 (회사부담)"
            value={formatCurrency(summary.totalEmployerCost)}
            sub={`원천징수 ${formatCurrency(summary.incomeTaxTotal + summary.localIncomeTaxTotal)}`}
            icon={Landmark}
            tone="bg-rose-100 text-rose-600"
          />
        </div>
      </header>

      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {PAYROLL_COMPANY_OPTIONS.map((company) => {
            const active = company.id === companyId;
            return (
              <Button
                key={company.id}
                type="button"
                variant={active ? "default" : "outline"}
                className={cn(
                  "h-10 px-4 font-semibold",
                  active &&
                    (company.id === "goldfender"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-indigo-600 hover:bg-indigo-700")
                )}
                onClick={() => setCompanyId(company.id)}
              >
                {company.label}
              </Button>
            );
          })}
        </div>

        <Card className="overflow-hidden border-slate-200/90 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-white py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <CardTitle className="text-base font-semibold">
                {activeCompany.label} 급여 명세 ({ledger.domestic.length}명)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <PayrollTable
              rows={ledger.domestic}
              ledger={ledger}
              summary={summary}
              reportingMonth={reportingMonth}
              showTaxableInput
              onTaxableChange={handleTaxableChange}
              onTaxableReset={handleTaxableReset}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
