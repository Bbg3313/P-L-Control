import * as XLSX from "xlsx";
import type { PayrollLedgerResult, PayrollLedgerRow } from "@/lib/payroll-ledger";
import { JUN_2026_INSURANCE_LABEL } from "@/lib/social-insurance-jun-2026";

function rowToCells(row: PayrollLedgerRow): (string | number)[] {
  return [
    row.name,
    row.department,
    row.position,
    row.monthlyGross,
    row.nonTaxable,
    row.taxableBase,
    row.employeePension,
    row.employeeHealth,
    row.employeeLongTermCare,
    row.employeeEmployment,
    row.employeeInsuranceTotal,
    row.incomeTax,
    row.localIncomeTax,
    row.incomeTaxRelief,
    row.totalDeductions,
    row.netPay,
    row.employerPension,
    row.employerHealth,
    row.employerLongTermCare,
    row.employerEmployment,
    row.employerIndustrial,
    row.employerInsuranceTotal,
    row.totalEmployerCost,
    row.note,
  ];
}

const HEADERS = [
  "성명",
  "부서",
  "직위",
  "기본급",
  "비과세",
  "과세표준",
  "국민연금(본인)",
  "건강보험(본인)",
  "장기요양(본인)",
  "고용보험(본인)",
  "4대보험합(본인)",
  "소득세",
  "지방소득세",
  "청년감면",
  "공제합계",
  "실지급액",
  "국민연금(회사)",
  "건강보험(회사)",
  "장기요양(회사)",
  "고용보험(회사)",
  "산재보험(회사)",
  "4대보험합(회사)",
  "총인건비",
  "비고",
];

function summaryRow(label: string, ledger: PayrollLedgerResult): (string | number)[] {
  const s = ledger.summary;
  return [
    label,
    "",
    "",
    s.grossTotal,
    s.nonTaxableTotal,
    s.taxableBaseTotal,
    "",
    "",
    "",
    "",
    s.employeeInsuranceTotal,
    s.incomeTaxTotal,
    s.localIncomeTaxTotal,
    s.incomeTaxReliefTotal,
    s.totalDeductions,
    s.netPayTotal,
    "",
    "",
    "",
    "",
    "",
    s.employerInsuranceTotal,
    s.totalEmployerCost,
    "",
  ];
}

export function downloadPayrollLedgerExcel(ledger: PayrollLedgerResult): void {
  const [year, month] = ledger.yearMonth.split("-");
  const title = `블루브릿지글로벌 급여대장 ${year}년 ${Number(month)}월`;
  const meta = [[`${title} · ${JUN_2026_INSURANCE_LABEL}`], []];

  const domesticRows = ledger.domestic.map(rowToCells);

  const sheetData: (string | number)[][] = [
    ...meta,
    HEADERS,
    ...domesticRows,
    summaryRow("합계", ledger),
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "급여대장");

  const colWidths = HEADERS.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...sheetData.map((row) => String(row[i] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 8), 24) };
  });
  ws["!cols"] = colWidths;

  XLSX.writeFile(wb, `급여대장_${ledger.yearMonth}.xlsx`);
}
