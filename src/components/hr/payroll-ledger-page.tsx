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
    <div className="flex w-full items-center justify-end gap-1">
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
          "h-8 w-[7.25rem] shrink-0 text-right text-sm tabular-nums",
          row.taxableBaseOverridden &&
            "border-amber-400 bg-amber-50 ring-1 ring-amber-200"
        )}
        aria-label={`${row.name} 과세표준`}
      />
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        {row.taxableBaseOverridden ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onReset}
            title="기본값 복원"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function colAlignClass(align: "center" | "right"): string {
  return align === "center"
    ? "px-2 text-center align-middle"
    : "px-3 text-right align-middle";
}

const PAYROLL_TABLE_COLUMNS = [
  { key: "no", label: "구분번호", align: "center" as const, width: "3.25rem" },
  { key: "name", label: "성명", align: "center" as const, width: "5.5rem" },
  { key: "basic", label: "기본급", align: "right" as const, width: "6.25rem" },
  { key: "nontax", label: "비과세", align: "right" as const, width: "5.5rem" },
  { key: "gross", label: "총지급액", align: "right" as const, width: "6.25rem" },
  { key: "taxable", label: "과세표준", align: "right" as const, width: "9.5rem" },
  {
    key: "empIns",
    label: "4대보험(본인)",
    align: "right" as const,
    width: "6.5rem",
  },
  { key: "incomeTax", label: "소득세", align: "right" as const, width: "6rem" },
  { key: "localTax", label: "지방세", align: "right" as const, width: "5.5rem" },
  { key: "net", label: "실지급", align: "right" as const, width: "6.25rem" },
  {
    key: "erIns",
    label: "4대보험(회사)",
    align: "right" as const,
    width: "6.5rem",
  },
  { key: "totalCost", label: "총인건비", align: "right" as const, width: "6.25rem" },
  { key: "note", label: "비고", align: "center" as const, width: "6.5rem" },
  { key: "payslip", label: "명세서", align: "center" as const, width: "5.5rem" },
];

function PayrollHead({
  align,
  children,
  className,
}: {
  align: "center" | "right";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead
      className={cn(
        colAlignClass(align),
        "whitespace-nowrap text-xs font-semibold text-slate-600",
        className
      )}
    >
      {children}
    </TableHead>
  );
}

function PayrollCell({
  align,
  children,
  className,
}: {
  align: "center" | "right";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableCell className={cn(colAlignClass(align), className)}>{children}</TableCell>
  );
}

function IncomeTaxCell({
  amount,
  relief,
}: {
  amount: number;
  relief?: number;
}) {
  return (
    <div className="flex min-h-[2.5rem] flex-col items-end justify-center">
      <MoneyCell value={amount} />
      {relief && relief > 0 ? (
        <p className="text-[11px] leading-4 text-emerald-600">
          감면 −{formatNumber(relief)}
        </p>
      ) : (
        <span className="h-4" aria-hidden />
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
    <Table className="w-full min-w-[82rem] table-fixed text-sm">
      <colgroup>
        {PAYROLL_TABLE_COLUMNS.map((col) => (
          <col key={col.key} style={{ width: col.width }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
          {PAYROLL_TABLE_COLUMNS.map((col) => (
            <PayrollHead key={col.key} align={col.align}>
              {col.label}
            </PayrollHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.id}>
            <PayrollCell align="center" className="tabular-nums text-slate-600">
              {index + 1}
            </PayrollCell>
            <PayrollCell align="center" className="font-medium text-slate-900">
              <div>{row.name}</div>
              {row.department && (
                <div className="text-xs font-normal text-muted-foreground">
                  {row.department}
                </div>
              )}
            </PayrollCell>
            <PayrollCell align="right">
              <MoneyCell value={getBasicPay(row)} />
            </PayrollCell>
            <PayrollCell align="right">
              <MoneyCell value={row.nonTaxable} />
            </PayrollCell>
            <PayrollCell align="right">
              <MoneyCell value={getTotalGrossPay(row)} />
            </PayrollCell>
            <PayrollCell align="right">
              {showTaxableInput ? (
                <TaxableBaseInput
                  row={row}
                  onChange={(value) => onTaxableChange(row.id, value)}
                  onReset={() => onTaxableReset(row.id)}
                />
              ) : (
                <MoneyCell value={row.taxableBase} />
              )}
            </PayrollCell>
            <PayrollCell align="right">
              <MoneyCell value={row.employeeInsuranceTotal} />
            </PayrollCell>
            <PayrollCell align="right">
              <IncomeTaxCell
                amount={row.incomeTax}
                relief={row.incomeTaxRelief}
              />
            </PayrollCell>
            <PayrollCell align="right">
              <MoneyCell value={row.localIncomeTax} />
            </PayrollCell>
            <PayrollCell align="right">
              <MoneyCell value={row.netPay} emphasis="indigo" />
            </PayrollCell>
            <PayrollCell align="right">
              <MoneyCell value={row.employerInsuranceTotal} />
            </PayrollCell>
            <PayrollCell align="right">
              <MoneyCell value={row.totalEmployerCost} emphasis="rose" />
            </PayrollCell>
            <PayrollCell align="center" className="text-xs text-muted-foreground">
              {row.note || "—"}
            </PayrollCell>
            <PayrollCell align="center">
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
            </PayrollCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter className="bg-slate-50/90 text-sm">
        <TableRow className="hover:bg-slate-50/90">
          <TableCell
            colSpan={2}
            className={cn(colAlignClass("center"), "font-semibold text-slate-900")}
          >
            합계
          </TableCell>
          <PayrollCell align="right">
            <MoneyCell value={summary.basicPayTotal} />
          </PayrollCell>
          <PayrollCell align="right">
            <MoneyCell value={summary.nonTaxableTotal} />
          </PayrollCell>
          <PayrollCell align="right">
            <MoneyCell value={summary.grossTotal} />
          </PayrollCell>
          <PayrollCell align="right">
            <MoneyCell value={summary.taxableBaseTotal} />
          </PayrollCell>
          <PayrollCell align="right">
            <MoneyCell value={summary.employeeInsuranceTotal} />
          </PayrollCell>
          <PayrollCell align="right">
            <IncomeTaxCell
              amount={summary.incomeTaxTotal}
              relief={summary.incomeTaxReliefTotal}
            />
          </PayrollCell>
          <PayrollCell align="right">
            <MoneyCell value={summary.localIncomeTaxTotal} />
          </PayrollCell>
          <PayrollCell align="right">
            <MoneyCell value={summary.netPayTotal} emphasis="indigo" />
          </PayrollCell>
          <PayrollCell align="right">
            <MoneyCell value={summary.employerInsuranceTotal} />
          </PayrollCell>
          <PayrollCell align="right">
            <MoneyCell value={summary.totalEmployerCost} emphasis="rose" />
          </PayrollCell>
          <PayrollCell align="center" className="text-xs text-muted-foreground">
            {formatPeriodLabel(reportingMonth)}
          </PayrollCell>
          <PayrollCell align="center">{" "}</PayrollCell>
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
