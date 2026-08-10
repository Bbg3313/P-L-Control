import type { PayrollLedgerResult, PayrollLedgerRow } from "@/lib/payroll-ledger";
import { getBasicPay } from "@/lib/payroll-ledger";
import {
  getPayrollCompanyForPerson,
  getPayrollCompanyLabel,
} from "@/lib/payroll-ledger";
import { formatNumber } from "@/lib/format";
import { formatPersonnelDisplayName } from "@/lib/personnel";
import { PAYROLL_CORPORATE_SEAL_DATA_URI } from "@/lib/payroll-corporate-seal";

/** 실물 법인인감 외경 기준 (mm) */
const CORPORATE_SEAL_SIZE_MM = 20;
import { JUN_2026_INSURANCE_LABEL } from "@/lib/social-insurance-jun-2026";

function periodLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}년 ${Number(month)}월`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function moneyCell(amount: number): string {
  return amount > 0 ? `${formatNumber(amount)}` : "—";
}

function buildLineRows(
  payLines: [string, number][],
  deductLines: [string, number][]
): string {
  const rows = Math.max(payLines.length, deductLines.length, 6);
  let html = "";

  for (let i = 0; i < rows; i += 1) {
    const pay = payLines[i];
    const deduct = deductLines[i];
    html += `
      <tr>
        <td class="item-label">${pay ? escapeHtml(pay[0]) : ""}</td>
        <td class="item-amount">${pay ? moneyCell(pay[1]) : ""}</td>
        <td class="divider"></td>
        <td class="item-label">${deduct ? escapeHtml(deduct[0]) : ""}</td>
        <td class="item-amount">${deduct ? moneyCell(deduct[1]) : ""}</td>
      </tr>`;
  }

  return html;
}

export function buildPayslipHtml(
  ledger: PayrollLedgerResult,
  row: PayrollLedgerRow,
  sequenceNo: number
): string {
  const period = periodLabel(ledger.yearMonth);
  const company = escapeHtml(ledger.companyLabel);
  const name = escapeHtml(formatPersonnelDisplayName(row.name));
  const affiliation = escapeHtml(
    getPayrollCompanyLabel(getPayrollCompanyForPerson(row.name))
  );

  const payLines: [string, number][] = [
    ["기본급여", getBasicPay(row)],
    ...(row.performancePay > 0
      ? ([["성과급", row.performancePay]] as [string, number][])
      : []),
  ];

  const deductLines: [string, number][] = [
    ["국민연금", row.employeePension],
    ["건강보험", row.employeeHealth],
    ["장기요양보험", row.employeeLongTermCare],
    ["고용보험", row.employeeEmployment],
    ["소득세", row.incomeTax],
    ["지방소득세", row.localIncomeTax],
  ];

  const nonTaxNote =
    row.nonTaxable > 0
      ? `<p class="note">※ 비과세 수당 ${formatNumber(row.nonTaxable)}원은 지급액에 포함되며, 원천세·4대보험 산정 시 제외합니다.</p>`
      : "";

  const basisHtml = `<div class="basis-box">
        <div class="basis-title">산정 참고 (지급액 아님)</div>
        <div class="basis-grid">
          <div>
            <span class="basis-label">과세표준 <span class="basis-use">(원천세)</span></span>
            <span class="basis-value">${formatNumber(row.taxableBase)}</span>
          </div>
          <div>
            <span class="basis-label">보수월액 <span class="basis-use">(4대보험)</span></span>
            <span class="basis-value">${formatNumber(row.insuranceRemunerationBase)}</span>
          </div>
        </div>
      </div>`;

  const noteHtml = row.note
    ? `<p class="note">※ ${escapeHtml(row.note)}</p>`
    : "";
  const reliefHtml =
    row.incomeTaxRelief > 0
      ? `<p class="note">※ 소득세·지방소득세 감면액 합계 ${formatNumber(row.incomeTaxRelief)}원</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>급여명세서 — ${name} — ${period}</title>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
  />
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #f1f5f9;
      font-family: Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      font-size: 11pt;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 190mm;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
    }
    .inner { padding: 28px 32px 32px; }
    .doc-header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #1e293b;
      margin-bottom: 20px;
    }
    .company {
      font-size: 11pt;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: #475569;
    }
    .title {
      margin: 10px 0 6px;
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 0.35em;
      text-indent: 0.35em;
      color: #0f172a;
    }
    .period-row {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 8px;
      font-size: 10pt;
      color: #64748b;
    }
    .meta {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 10.5pt;
    }
    .meta th,
    .meta td {
      border: 1px solid #cbd5e1;
      padding: 9px 12px;
    }
    .meta th {
      width: 14%;
      background: #f8fafc;
      font-weight: 600;
      color: #334155;
      text-align: center;
    }
    .meta td {
      width: 36%;
      color: #0f172a;
    }
    .section-title {
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin-bottom: 0;
      font-size: 10.5pt;
      font-weight: 700;
      text-align: center;
      color: #fff;
    }
    .section-title span {
      padding: 8px 0;
      background: #334155;
      border: 1px solid #334155;
    }
    .section-title span:first-child {
      border-right: none;
    }
    .lines {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
      font-size: 10.5pt;
    }
    .lines th {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      font-weight: 600;
      color: #475569;
      text-align: center;
    }
    .lines td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
    }
    .lines .item-label { width: 22%; color: #334155; }
    .lines .item-amount {
      width: 22%;
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }
    .lines .divider {
      width: 4%;
      border-left: 1px solid #cbd5e1;
      border-right: 1px solid #cbd5e1;
      background: #f8fafc;
    }
    .totals {
      width: 100%;
      border-collapse: collapse;
      margin-top: -1px;
      font-size: 10.5pt;
    }
    .totals td {
      border: 1px solid #cbd5e1;
      padding: 10px 12px;
      font-weight: 700;
    }
    .totals .label {
      width: 22%;
      background: #f8fafc;
      color: #334155;
      text-align: center;
    }
    .totals .amount {
      width: 22%;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: #0f172a;
    }
    .totals .gap { width: 4%; background: #f8fafc; }
    .net-pay {
      margin-top: 16px;
      border: 2px solid #1e293b;
      background: #f8fafc;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .net-pay .label {
      font-size: 13pt;
      font-weight: 700;
      letter-spacing: 0.2em;
      color: #1e293b;
    }
    .net-pay .value {
      font-size: 18pt;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #1d4ed8;
    }
    .net-pay .unit {
      font-size: 11pt;
      font-weight: 600;
      color: #64748b;
      margin-left: 4px;
    }
    .notes {
      margin-top: 14px;
      font-size: 9.5pt;
      color: #64748b;
      line-height: 1.6;
    }
    .note { margin: 4px 0 0; }
    .basis-box {
      margin-top: 14px;
      padding: 12px 14px;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
    }
    .basis-title {
      font-size: 9.5pt;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 8px;
    }
    .basis-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      font-size: 10pt;
    }
    .basis-grid > div {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: baseline;
    }
    .basis-label { color: #475569; }
    .basis-use { color: #94a3b8; font-weight: 500; }
    .basis-value {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: #334155;
    }
    .footer {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 10pt;
      color: #475569;
      line-height: 1.8;
    }
    .footer .company-sign {
      margin-top: 12px;
      font-size: 11pt;
      font-weight: 600;
      color: #0f172a;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .stamp-area {
      display: inline-block;
      width: ${CORPORATE_SEAL_SIZE_MM}mm;
      height: ${CORPORATE_SEAL_SIZE_MM}mm;
      vertical-align: middle;
      flex-shrink: 0;
      background: transparent;
    }
    .corporate-seal {
      display: block;
      width: ${CORPORATE_SEAL_SIZE_MM}mm;
      height: ${CORPORATE_SEAL_SIZE_MM}mm;
      object-fit: contain;
      background: transparent;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .page { border: none; box-shadow: none; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="inner">
      <header class="doc-header">
        <div class="company">${company}</div>
        <h1 class="title">급여명세서</h1>
        <div class="period-row">
          <span>귀속 ${period}</span>
          <span>단위: 원</span>
        </div>
      </header>

      <table class="meta">
        <tbody>
          <tr>
            <th>성명</th>
            <td>${name}</td>
            <th>구분번호</th>
            <td>${sequenceNo}</td>
          </tr>
          <tr>
            <th>소속</th>
            <td>${affiliation}</td>
            <th>총지급액</th>
            <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">
              ${formatNumber(row.monthlyGross)}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">
        <span>지급 내역</span>
        <span>공제 내역</span>
      </div>
      <table class="lines">
        <thead>
          <tr>
            <th>항목</th>
            <th>금액</th>
            <th class="divider"></th>
            <th>항목</th>
            <th>금액</th>
          </tr>
        </thead>
        <tbody>
          ${buildLineRows(payLines, deductLines)}
        </tbody>
      </table>

      <table class="totals">
        <tbody>
          <tr>
            <td class="label">총지급액</td>
            <td class="amount">${formatNumber(row.monthlyGross)}</td>
            <td class="gap"></td>
            <td class="label">공제합계</td>
            <td class="amount">${formatNumber(row.totalDeductions)}</td>
          </tr>
        </tbody>
      </table>

      <div class="net-pay">
        <span class="label">실 지급 액</span>
        <span>
          <span class="value">${formatNumber(row.netPay)}</span>
          <span class="unit">원</span>
        </span>
      </div>

      ${basisHtml}

      <div class="notes">
        ${nonTaxNote}
        ${noteHtml}
        ${reliefHtml}
        <p class="note">※ ${escapeHtml(JUN_2026_INSURANCE_LABEL)} 기준 산출</p>
      </div>

      <footer class="footer">
        <p>위 금액을 정히 지급하였음을 확인합니다.</p>
        <p class="company-sign">
          ${company}
          <span class="stamp-area">
            <img
              class="corporate-seal"
              src="${PAYROLL_CORPORATE_SEAL_DATA_URI}"
              alt="법인인감"
            />
          </span>
        </p>
      </footer>
    </div>
  </div>
</body>
</html>`;
}

function downloadHtmlFile(filename: string, html: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** 근로자 교부용 급여명세서 (인쇄·PDF 저장 가능 HTML) */
export function downloadPayrollPayslipExcel(
  ledger: PayrollLedgerResult,
  row: PayrollLedgerRow,
  sequenceNo: number
): void {
  const html = buildPayslipHtml(ledger, row, sequenceNo);
  downloadHtmlFile(
    `급여명세서_${row.name}_${ledger.yearMonth}.html`,
    html
  );
}
