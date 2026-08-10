"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  FileDown,
  Landmark,
  Mail,
  PiggyBank,
  RotateCcw,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableFooter,
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
  PAYROLL_COMPANY_OPTIONS,
  type PayrollCompanyId,
  type PayrollLedgerResult,
  type PayrollLedgerRow,
  type PayrollLedgerSummary,
} from "@/lib/payroll-ledger";
import {
  EMPLOYEE_DEDUCTION_RATE_TOOLTIPS,
  GOLDFENDER_DEDUCTION_RATE_TOOLTIPS,
} from "@/lib/social-insurance-jun-2026";
import { formatPersonnelDisplayName } from "@/lib/personnel";
import {
  loadPersonnelEmails,
  type PersonnelEmails,
} from "@/lib/personnel-emails-store";
import {
  loadPayrollNoteOverrides,
  loadPayrollPerformancePayOverrides,
  savePayrollNoteOverrides,
  savePayrollPerformancePayOverrides,
  setNoteOverride,
  setPerformancePayOverride,
  type PayrollNoteOverrides,
  type PayrollPerformancePayOverrides,
} from "@/lib/payroll-ledger-store";
import { getDefaultPayrollMemo } from "@/lib/payroll-personnel-notes";
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
    <Card className="min-w-0 border-slate-200/90 shadow-sm">
      <CardContent className="flex items-center gap-2 p-2.5 sm:p-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            tone
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-900">
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
  title,
}: {
  value: number;
  emphasis?: "indigo" | "rose";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "tabular-nums text-sm text-slate-800",
        title && "cursor-help",
        emphasis === "indigo" && "font-semibold text-indigo-700",
        emphasis === "rose" && "font-semibold text-rose-700"
      )}
    >
      {formatNumber(value)}
    </span>
  );
}

function NoteInput({
  row,
  onChange,
  onReset,
}: {
  row: PayrollLedgerRow;
  onChange: (value: string) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(row.note);

  useEffect(() => {
    setDraft(row.note);
  }, [row.note]);

  return (
    <div
      className={cn(
        "payroll-note-wrap",
        row.noteOverridden && "payroll-note-wrap--with-reset"
      )}
    >
      <textarea
        value={draft}
        rows={2}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onChange(draft.trim())}
        className={cn(
          "payroll-note-input shadow-none",
          row.noteOverridden &&
            "border-amber-400 bg-amber-50 ring-1 ring-amber-200"
        )}
        aria-label={`${row.name} 비고`}
        placeholder={getDefaultPayrollMemo(row.name) || "비고 입력"}
      />
      {row.noteOverridden ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="payroll-note-reset h-7 w-7 shrink-0 text-muted-foreground"
          onClick={onReset}
          title="기본 비고 복원"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function PerformancePayInput({
  row,
  onChange,
  onReset,
}: {
  row: PayrollLedgerRow;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(formatAmountInputValue(row.performancePay));

  useEffect(() => {
    setDraft(formatAmountInputValue(row.performancePay));
  }, [row.performancePay]);

  return (
    <div
      className={cn(
        "payroll-taxable-wrap",
        row.performancePay > 0 && "payroll-taxable-wrap--with-reset"
      )}
    >
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
          "payroll-taxable-input shadow-none",
          row.performancePay > 0 &&
            "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200"
        )}
        aria-label={`${row.name} 성과급`}
      />
      {row.performancePay > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="payroll-taxable-reset h-7 w-7 text-muted-foreground"
          onClick={onReset}
          title="성과급 초기화"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

type CellAlign = "center" | "right";

function PayrollTh({
  align,
  children,
  className,
  colSpan,
  rowSpan,
  title,
}: {
  align: CellAlign;
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
  title?: string;
}) {
  return (
    <th
      data-align={align}
      colSpan={colSpan}
      rowSpan={rowSpan}
      title={title}
      className={cn(
        "payroll-cell payroll-header-cell",
        title && "cursor-help",
        className
      )}
    >
      {children}
    </th>
  );
}

function PayrollTd({
  align,
  children,
  className,
  colSpan,
}: {
  align: CellAlign;
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      data-align={align}
      colSpan={colSpan}
      className={cn("payroll-cell", className)}
      style={{ textAlign: align }}
    >
      {children}
    </td>
  );
}

const PAYROLL_LEADING_COLUMNS = [
  { key: "no", label: "구분번호", align: "center" as const, minWidth: "4rem" },
  { key: "name", label: "성명", align: "center" as const, minWidth: "10.5rem" },
  { key: "basic", label: "기본급여", align: "right" as const, minWidth: "6rem" },
  { key: "performance", label: "성과급", align: "right" as const, minWidth: "6.5rem" },
  { key: "nontax", label: "비과세", align: "right" as const, minWidth: "5.5rem" },
  { key: "gross", label: "총지급액", align: "right" as const, minWidth: "6rem" },
  { key: "taxable", label: "과세표준", align: "right" as const, minWidth: "6.5rem" },
] as const;

const PAYROLL_DEDUCTION_COLUMNS = [
  {
    key: "pension" as const,
    label: "국민",
    align: "right" as const,
    minWidth: "4.5rem",
  },
  {
    key: "health" as const,
    label: "건강",
    align: "right" as const,
    minWidth: "4.5rem",
  },
  {
    key: "ltc" as const,
    label: "장기",
    align: "right" as const,
    minWidth: "4.5rem",
  },
  {
    key: "employment" as const,
    label: "고용",
    align: "right" as const,
    minWidth: "4.5rem",
  },
] as const;

function deductionRateTooltip(
  key: (typeof PAYROLL_DEDUCTION_COLUMNS)[number]["key"],
  companyId: PayrollCompanyId
): string {
  const tips =
    companyId === "goldfender"
      ? GOLDFENDER_DEDUCTION_RATE_TOOLTIPS
      : EMPLOYEE_DEDUCTION_RATE_TOOLTIPS;
  if (key === "pension") return tips.pension;
  if (key === "health") return tips.health;
  if (key === "ltc") return tips.longTermCare;
  return tips.employment;
}

const PAYROLL_TRAILING_COLUMNS = [
  { key: "incomeTax", label: "소득세", align: "right" as const, minWidth: "6rem" },
  { key: "localTax", label: "지방세", align: "right" as const, minWidth: "5.5rem" },
  { key: "net", label: "실지급", align: "right" as const, minWidth: "6rem" },
  {
    key: "erIns",
    label: "4대보험(회사)",
    align: "right" as const,
    minWidth: "8.5rem",
  },
  { key: "totalCost", label: "총인건비", align: "right" as const, minWidth: "6rem" },
  { key: "note", label: "비고", align: "center" as const, minWidth: "11rem" },
  { key: "payslip", label: "명세서", align: "center" as const, minWidth: "5rem" },
] as const;

const PAYROLL_TABLE_COLUMNS = [
  ...PAYROLL_LEADING_COLUMNS,
  ...PAYROLL_DEDUCTION_COLUMNS,
  ...PAYROLL_TRAILING_COLUMNS,
];

function IncomeTaxCell({
  amount,
  relief,
}: {
  amount: number;
  relief?: number;
}) {
  const hasRelief = !!(relief && relief > 0);

  return (
    <div className="payroll-income-tax-cell">
      <div className="payroll-income-tax-amount">
        <MoneyCell value={amount} />
      </div>
      <div className="payroll-income-tax-sub">
        {hasRelief ? (
          <span className="payroll-income-tax-relief">
            감면 −{formatNumber(relief)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PayrollTable({
  rows,
  ledger,
  summary,
  reportingMonth,
  companyId,
  onPerformancePayChange,
  onPerformancePayReset,
  onNoteChange,
  onNoteReset,
}: {
  rows: PayrollLedgerRow[];
  ledger: PayrollLedgerResult;
  summary: PayrollLedgerSummary;
  reportingMonth: string;
  companyId: PayrollCompanyId;
  onPerformancePayChange: (id: string, value: number) => void;
  onPerformancePayReset: (id: string) => void;
  onNoteChange: (id: string, value: string) => void;
  onNoteReset: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        표시할 인원이 없습니다.
      </p>
    );
  }

  return (
    <Table className="payroll-ledger-table !w-max min-w-full text-sm">
        <colgroup>
          {PAYROLL_TABLE_COLUMNS.map((col) => (
            <col key={col.key} style={{ width: col.minWidth, minWidth: col.minWidth }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            {PAYROLL_LEADING_COLUMNS.map((col) => (
              <PayrollTh key={col.key} align="center" rowSpan={2}>
                {col.label}
              </PayrollTh>
            ))}
            <PayrollTh align="center" colSpan={PAYROLL_DEDUCTION_COLUMNS.length}>
              공제내역
            </PayrollTh>
            {PAYROLL_TRAILING_COLUMNS.map((col) => (
              <PayrollTh key={col.key} align="center" rowSpan={2}>
                {col.label}
              </PayrollTh>
            ))}
          </TableRow>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            {PAYROLL_DEDUCTION_COLUMNS.map((col) => (
              <PayrollTh
                key={col.key}
                align="center"
                title={deductionRateTooltip(col.key, companyId)}
              >
                <span className="border-b border-dotted border-slate-400/80">
                  {col.label}
                </span>
              </PayrollTh>
            ))}
          </TableRow>
        </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.id}>
            <PayrollTd align="center" className="text-slate-600">
              {index + 1}
            </PayrollTd>
            <PayrollTd align="center" className="font-medium text-slate-900">
              <div>{formatPersonnelDisplayName(row.name)}</div>
              {row.department && (
                <div className="text-xs font-normal text-muted-foreground">
                  {row.department}
                </div>
              )}
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell value={getBasicPay(row)} />
            </PayrollTd>
            <PayrollTd align="right">
              {row.usesSplitPayrollCalc ? (
                <PerformancePayInput
                  row={row}
                  onChange={(value) => onPerformancePayChange(row.id, value)}
                  onReset={() => onPerformancePayReset(row.id)}
                />
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell value={row.nonTaxable} />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell value={getTotalGrossPay(row)} />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell value={row.taxableBase} />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell
                value={row.employeePension}
                title={deductionRateTooltip("pension", companyId)}
              />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell
                value={row.employeeHealth}
                title={deductionRateTooltip("health", companyId)}
              />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell
                value={row.employeeLongTermCare}
                title={deductionRateTooltip("ltc", companyId)}
              />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell
                value={row.employeeEmployment}
                title={deductionRateTooltip("employment", companyId)}
              />
            </PayrollTd>
            <PayrollTd align="right">
              <IncomeTaxCell
                amount={row.incomeTax}
                relief={row.incomeTaxRelief}
              />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell value={row.localIncomeTax} />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell value={row.netPay} emphasis="indigo" />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell value={row.employerInsuranceTotal} />
            </PayrollTd>
            <PayrollTd align="right">
              <MoneyCell value={row.totalEmployerCost} emphasis="rose" />
            </PayrollTd>
            <PayrollTd align="center" className="text-xs">
              <NoteInput
                row={row}
                onChange={(value) => onNoteChange(row.id, value)}
                onReset={() => onNoteReset(row.id)}
              />
            </PayrollTd>
            <PayrollTd align="center">
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
            </PayrollTd>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter className="bg-slate-50/90 text-sm">
        <TableRow className="hover:bg-slate-50/90">
          <PayrollTd
            align="center"
            colSpan={2}
            className="font-semibold text-slate-900"
          >
            합계
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell value={summary.basicPayTotal} />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell value={summary.performancePayTotal} />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell value={summary.nonTaxableTotal} />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell value={summary.grossTotal} />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell value={summary.taxableBaseTotal} />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell
              value={rows.reduce((sum, row) => sum + row.employeePension, 0)}
            />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell
              value={rows.reduce((sum, row) => sum + row.employeeHealth, 0)}
            />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell
              value={rows.reduce(
                (sum, row) => sum + row.employeeLongTermCare,
                0
              )}
            />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell
              value={rows.reduce((sum, row) => sum + row.employeeEmployment, 0)}
            />
          </PayrollTd>
          <PayrollTd align="right">
            <IncomeTaxCell
              amount={summary.incomeTaxTotal}
              relief={summary.incomeTaxReliefTotal}
            />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell value={summary.localIncomeTaxTotal} />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell value={summary.netPayTotal} emphasis="indigo" />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell value={summary.employerInsuranceTotal} />
          </PayrollTd>
          <PayrollTd align="right">
            <MoneyCell value={summary.totalEmployerCost} emphasis="rose" />
          </PayrollTd>
          <PayrollTd align="center" className="text-xs text-muted-foreground">
            {formatPeriodLabel(reportingMonth)}
          </PayrollTd>
          <PayrollTd align="center">{" "}</PayrollTd>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function PayrollLedgerPage() {
  const { personnel, reportingMonth, hydrated } = useFinancial();
  const [companyId, setCompanyId] = useState<PayrollCompanyId>("bluebridge");
  const [performancePayOverrides, setPerformancePayOverrides] =
    useState<PayrollPerformancePayOverrides>({});
  const [noteOverrides, setNoteOverrides] = useState<PayrollNoteOverrides>({});
  const [overridesReady, setOverridesReady] = useState(false);
  const [hrRecords, setHrRecords] = useState<HrEmployeeRecord[]>([]);
  const [personnelEmails, setPersonnelEmails] = useState<PersonnelEmails>({});
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<
    | {
        sentCount: number;
        failCount: number;
        skipCount: number;
        results: {
          name: string;
          email: string | null;
          ok: boolean;
          skipped?: boolean;
          error?: string;
        }[];
      }
    | null
  >(null);

  useEffect(() => {
    setPerformancePayOverrides(loadPayrollPerformancePayOverrides());
    setNoteOverrides(loadPayrollNoteOverrides());
    setPersonnelEmails(loadPersonnelEmails());
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

  const monthPerformancePayOverrides = useMemo(
    () => performancePayOverrides[reportingMonth] ?? {},
    [performancePayOverrides, reportingMonth]
  );

  const monthNoteOverrides = useMemo(
    () => noteOverrides[reportingMonth] ?? {},
    [noteOverrides, reportingMonth]
  );

  const ledger = useMemo(
    () =>
      buildPayrollLedger(
        reportingMonth,
        personnel,
        hrByName,
        companyId,
        monthPerformancePayOverrides,
        monthNoteOverrides
      ),
    [
      reportingMonth,
      personnel,
      monthPerformancePayOverrides,
      monthNoteOverrides,
      hrByName,
      companyId,
    ]
  );

  const activeCompany =
    PAYROLL_COMPANY_OPTIONS.find((c) => c.id === companyId) ??
    PAYROLL_COMPANY_OPTIONS[0];

  const persistPerformancePayOverrides = useCallback(
    (next: PayrollPerformancePayOverrides) => {
      setPerformancePayOverrides(next);
      savePayrollPerformancePayOverrides(next);
    },
    []
  );

  const persistNoteOverrides = useCallback((next: PayrollNoteOverrides) => {
    setNoteOverrides(next);
    savePayrollNoteOverrides(next);
  }, []);

  const handleNoteChange = useCallback(
    (personId: string, value: string) => {
      const next = setNoteOverride(
        noteOverrides,
        reportingMonth,
        personId,
        value || null
      );
      persistNoteOverrides(next);
    },
    [noteOverrides, reportingMonth, persistNoteOverrides]
  );

  const handleNoteReset = useCallback(
    (personId: string) => {
      const next = setNoteOverride(
        noteOverrides,
        reportingMonth,
        personId,
        null
      );
      persistNoteOverrides(next);
    },
    [noteOverrides, reportingMonth, persistNoteOverrides]
  );

  const handlePerformancePayChange = useCallback(
    (personId: string, value: number) => {
      const next = setPerformancePayOverride(
        performancePayOverrides,
        reportingMonth,
        personId,
        value > 0 ? value : null
      );
      persistPerformancePayOverrides(next);
    },
    [performancePayOverrides, reportingMonth, persistPerformancePayOverrides]
  );

  const handlePerformancePayReset = useCallback(
    (personId: string) => {
      const next = setPerformancePayOverride(
        performancePayOverrides,
        reportingMonth,
        personId,
        null
      );
      persistPerformancePayOverrides(next);
    },
    [performancePayOverrides, reportingMonth, persistPerformancePayOverrides]
  );

  const handleDownload = useCallback(() => {
    downloadPayrollLedgerExcel(ledger);
  }, [ledger]);

  const sendPreview = useMemo(() => {
    return ledger.domestic.map((row) => ({
      name: row.name,
      email: personnelEmails[row.name]?.trim() || null,
    }));
  }, [ledger.domestic, personnelEmails]);

  const sendableCount = sendPreview.filter((p) => p.email).length;

  const openSendDialog = useCallback(() => {
    setPersonnelEmails(loadPersonnelEmails());
    setSendError(null);
    setSendResults(null);
    setSendDialogOpen(true);
  }, []);

  const handleSendPayslips = useCallback(async () => {
    setSending(true);
    setSendError(null);
    setSendResults(null);
    try {
      const emailsForMonth: Record<string, string> = {};
      for (const row of ledger.domestic) {
        const email = personnelEmails[row.name]?.trim();
        if (email) emailsForMonth[row.name] = email;
      }

      const res = await fetch("/api/payroll/send-payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearMonth: reportingMonth,
          companyId,
          emails: emailsForMonth,
          performancePayOverrides: monthPerformancePayOverrides,
          noteOverrides: monthNoteOverrides,
          personnel,
          hrByName,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        sentCount?: number;
        failCount?: number;
        skipCount?: number;
        results?: {
          name: string;
          email: string | null;
          ok: boolean;
          skipped?: boolean;
          error?: string;
        }[];
      };

      if (!res.ok) {
        setSendError(data.error ?? "발송에 실패했습니다.");
        return;
      }

      setSendResults({
        sentCount: data.sentCount ?? 0,
        failCount: data.failCount ?? 0,
        skipCount: data.skipCount ?? 0,
        results: data.results ?? [],
      });
    } catch {
      setSendError("발송 요청에 실패했습니다. 네트워크를 확인해 주세요.");
    } finally {
      setSending(false);
    }
  }, [
    ledger.domestic,
    personnelEmails,
    reportingMonth,
    companyId,
    monthPerformancePayOverrides,
    monthNoteOverrides,
    personnel,
    hrByName,
  ]);

  if (!hydrated || !overridesReady) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        급여대장을 불러오는 중…
      </div>
    );
  }

  const { summary } = ledger;

  return (
    <div className="payroll-ledger-page flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <header className="sticky top-0 z-30 w-full max-w-full shrink-0 border-b border-slate-200/80 bg-slate-50/95 px-4 pb-3 pt-4 shadow-sm backdrop-blur-sm md:px-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-slate-900">
              급여대장
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              고정 연봉 기준 · 성수린·김소연·니키·정수민
              성과급 입력 · 비고 셀 직접 수정 가능
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <ReportingMonthNav className="w-full sm:w-auto" />
            <Button
              type="button"
              variant="outline"
              onClick={openSendDialog}
              className="h-8 gap-1.5 px-3 text-sm"
            >
              <Mail className="h-3.5 w-3.5" />
              명세서 일괄 발송
            </Button>
            <Button
              type="button"
              onClick={handleDownload}
              className="h-8 gap-1.5 px-3 text-sm"
            >
              <Download className="h-3.5 w-3.5" />
              엑셀 다운로드
            </Button>
          </div>
        </div>

        <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 xl:grid-cols-4">
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
                  "h-8 px-3 text-sm font-semibold",
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
              <CardTitle className="text-sm font-semibold">
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
              companyId={companyId}
              onPerformancePayChange={handlePerformancePayChange}
              onPerformancePayReset={handlePerformancePayReset}
              onNoteChange={handleNoteChange}
              onNoteReset={handleNoteReset}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>급여명세서 일괄 발송</DialogTitle>
            <DialogDescription>
              {formatPeriodLabel(reportingMonth)} · {activeCompany.label} ·
              이메일 등록된 {sendableCount}명 / 전체 {sendPreview.length}명
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-md border border-border/80 p-3 text-sm">
            {sendPreview.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2"
              >
                <span className="font-medium">
                  {formatPersonnelDisplayName(item.name)}
                </span>
                <span
                  className={
                    item.email
                      ? "truncate text-muted-foreground"
                      : "text-amber-700"
                  }
                >
                  {item.email ?? "이메일 없음 (스킵)"}
                </span>
              </div>
            ))}
          </div>

          {sendableCount === 0 ? (
            <p className="text-sm text-amber-800">
              발송할 이메일이 없습니다.{" "}
              <Link
                href="/settings"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                설정
              </Link>
              에서 직원 이메일을 등록하세요.
            </p>
          ) : null}

          {sendError ? (
            <p className="text-sm text-destructive" role="alert">
              {sendError}
            </p>
          ) : null}

          {sendResults ? (
            <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
              <p>
                성공 {sendResults.sentCount} · 실패 {sendResults.failCount} ·
                스킵 {sendResults.skipCount}
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {sendResults.results.map((r) => (
                  <li key={r.name}>
                    {r.name}:{" "}
                    {r.ok
                      ? "발송 완료"
                      : r.skipped
                        ? "스킵"
                        : r.error ?? "실패"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSendDialogOpen(false)}
              disabled={sending}
            >
              닫기
            </Button>
            <Button
              type="button"
              onClick={handleSendPayslips}
              disabled={sending || sendableCount === 0}
              className="gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" />
              {sending ? "발송 중…" : "발송"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
