import {
  calcEmployeeInsuranceBreakdown,
  calcMonthlyWithholdingTaxFromInsuranceBase,
  type EmployeeInsuranceBreakdown,
} from "@/lib/income-tax-2026";
import { getMonthlyNonTaxableAllowance } from "@/lib/non-taxable-allowance";
import {
  isEmploymentInsuranceExempt,
  isOverseasTeam,
  type PersonnelEntry,
} from "@/lib/personnel";
import { applyPersonnelReferenceSalary } from "@/lib/personnel-reference-salaries";
import {
  calcEmployerContributionsFromInsuranceBase,
  JUN_2026_INSURANCE_LABEL,
  monthlyGrossFromSalary,
} from "@/lib/social-insurance-jun-2026";
import {
  isYouthIncomeTaxReliefEligible,
  type YouthTaxReliefBreakdown,
} from "@/lib/youth-income-tax-relief";

export { JUN_2026_INSURANCE_LABEL };

export type PayrollCompanyId = "bluebridge" | "goldfender";

export const PAYROLL_COMPANY_OPTIONS: {
  id: PayrollCompanyId;
  label: string;
}[] = [
  { id: "bluebridge", label: "블루브릿지글로벌" },
  { id: "goldfender", label: "골드펜더" },
];

const GOLDFENDER_PERSONNEL = new Set<string>(["박양근"]);

export function getPayrollCompanyForPerson(name: string): PayrollCompanyId {
  return GOLDFENDER_PERSONNEL.has(name) ? "goldfender" : "bluebridge";
}

export function getPayrollCompanyLabel(companyId: PayrollCompanyId): string {
  return (
    PAYROLL_COMPANY_OPTIONS.find((c) => c.id === companyId)?.label ??
    "블루브릿지글로벌"
  );
}

export function filterPersonnelByPayrollCompany(
  personnel: PersonnelEntry[],
  companyId: PayrollCompanyId
): PersonnelEntry[] {
  return personnel.filter((entry) => {
    if (isOverseasTeam(entry.name)) return false;
    return getPayrollCompanyForPerson(entry.name) === companyId;
  });
}

export interface PayrollLedgerRow {
  id: string;
  name: string;
  department: string;
  position: string;
  isOverseas: boolean;
  monthlyGross: number;
  nonTaxable: number;
  defaultTaxableBase: number;
  taxableBase: number;
  taxableBaseOverridden: boolean;
  employeePension: number;
  employeeHealth: number;
  employeeLongTermCare: number;
  employeeEmployment: number;
  employeeInsuranceTotal: number;
  incomeTax: number;
  localIncomeTax: number;
  incomeTaxRelief: number;
  youthReliefEligible: boolean;
  totalDeductions: number;
  netPay: number;
  employerPension: number;
  employerHealth: number;
  employerLongTermCare: number;
  employerEmployment: number;
  employerIndustrial: number;
  employerInsuranceTotal: number;
  totalEmployerCost: number;
  note: string;
}

/** 과세 급여 (비과세 제외) */
export function getBasicPay(row: PayrollLedgerRow): number {
  return row.defaultTaxableBase;
}

/** 총지급액 (세전 월급) */
export function getTotalGrossPay(row: PayrollLedgerRow): number {
  return row.monthlyGross;
}

export interface PayrollLedgerSummary {
  domesticCount: number;
  overseasCount: number;
  basicPayTotal: number;
  grossTotal: number;
  nonTaxableTotal: number;
  taxableBaseTotal: number;
  employeeInsuranceTotal: number;
  incomeTaxTotal: number;
  localIncomeTaxTotal: number;
  incomeTaxReliefTotal: number;
  totalDeductions: number;
  netPayTotal: number;
  employerInsuranceTotal: number;
  totalEmployerCost: number;
}

export interface PayrollLedgerResult {
  yearMonth: string;
  companyId: PayrollCompanyId;
  companyLabel: string;
  domestic: PayrollLedgerRow[];
  overseas: PayrollLedgerRow[];
  summary: PayrollLedgerSummary;
}

export function resolvePersonnelForPayroll(entry: PersonnelEntry): PersonnelEntry {
  return applyPersonnelReferenceSalary(entry.name, entry);
}

function withoutEmployeeEmploymentInsurance(
  breakdown: EmployeeInsuranceBreakdown
): EmployeeInsuranceBreakdown {
  if (breakdown.employment === 0) return breakdown;
  return {
    ...breakdown,
    employment: 0,
    total: breakdown.total - breakdown.employment,
  };
}

function withoutEmployerEmploymentInsurance(
  employer: ReturnType<typeof calcEmployerContributionsFromInsuranceBase>
) {
  if (employer.employmentEmployer === 0) return employer;
  return {
    ...employer,
    employmentUnemployment: 0,
    employmentStability: 0,
    employmentEmployer: 0,
    totalEmployerContributions:
      employer.totalEmployerContributions - employer.employmentEmployer,
  };
}

function calcYouthTaxFromInsuranceBase(
  monthlyGross: number,
  nonTaxableMonthly: number,
  insuranceBase: number,
  employeeInsuranceTotal: number
): YouthTaxReliefBreakdown | null {
  if (monthlyGross <= 0) return null;

  const incomeTaxBeforeRelief =
    calcMonthlyWithholdingTaxFromInsuranceBase(insuranceBase);
  const localIncomeTaxBeforeRelief = Math.floor(incomeTaxBeforeRelief * 0.1);

  const incomeTaxRelief = Math.min(
    Math.floor(incomeTaxBeforeRelief * 0.9),
    Math.floor(2_000_000 / 12)
  );
  const incomeTaxAfterRelief = Math.max(
    0,
    incomeTaxBeforeRelief - incomeTaxRelief
  );
  const localIncomeTaxAfterRelief = Math.floor(incomeTaxAfterRelief * 0.1);
  const localIncomeTaxRelief =
    localIncomeTaxBeforeRelief - localIncomeTaxAfterRelief;

  const estimatedNetPay =
    monthlyGross -
    employeeInsuranceTotal -
    incomeTaxAfterRelief -
    localIncomeTaxAfterRelief;

  return {
    monthlyGross,
    nonTaxableMonthly,
    insuranceBase,
    employeeInsurance: employeeInsuranceTotal,
    incomeTaxBeforeRelief,
    incomeTaxRelief,
    incomeTaxAfterRelief,
    localIncomeTaxBeforeRelief,
    localIncomeTaxRelief,
    localIncomeTaxAfterRelief,
    estimatedNetPay,
  };
}

function buildDomesticRow(
  entry: PersonnelEntry,
  hrMeta: { department: string; position: string },
  taxableOverride?: number
): PayrollLedgerRow {
  const resolved = resolvePersonnelForPayroll(entry);
  const nonTaxable = getMonthlyNonTaxableAllowance(resolved.name);
  const monthlyGross =
    resolved.inputMode === "salary" && resolved.salaryAmount > 0
      ? monthlyGrossFromSalary(resolved.salaryAmount, resolved.salaryBasis)
      : resolved.directMonthlyAmount;

  const defaultTaxableBase = Math.max(0, monthlyGross - nonTaxable);
  const taxableBase =
    taxableOverride !== undefined ? taxableOverride : defaultTaxableBase;
  const taxableBaseOverridden = taxableOverride !== undefined;

  const employmentExempt = isEmploymentInsuranceExempt(resolved.name);
  let employee = calcEmployeeInsuranceBreakdown(taxableBase);
  let employer = calcEmployerContributionsFromInsuranceBase(taxableBase);
  if (employmentExempt) {
    employee = withoutEmployeeEmploymentInsurance(employee);
    employer = withoutEmployerEmploymentInsurance(employer);
  }
  const youthEligible = isYouthIncomeTaxReliefEligible(resolved.name);

  let incomeTax = 0;
  let localIncomeTax = 0;
  let incomeTaxRelief = 0;
  let netPay = monthlyGross;

  if (youthEligible) {
    const youth = calcYouthTaxFromInsuranceBase(
      monthlyGross,
      nonTaxable,
      taxableBase,
      employee.total
    );
    if (youth) {
      incomeTax = youth.incomeTaxAfterRelief;
      localIncomeTax = youth.localIncomeTaxAfterRelief;
      incomeTaxRelief = youth.incomeTaxRelief + youth.localIncomeTaxRelief;
      netPay = youth.estimatedNetPay;
    }
  } else {
    incomeTax = calcMonthlyWithholdingTaxFromInsuranceBase(taxableBase);
    localIncomeTax = Math.floor(incomeTax * 0.1);
    netPay = monthlyGross - employee.total - incomeTax - localIncomeTax;
  }

  const totalDeductions = employee.total + incomeTax + localIncomeTax;
  const notes: string[] = [];
  if (employmentExempt) notes.push("고용보험 미가입");
  if (youthEligible) notes.push("청년소득세 90% 감면");
  if (taxableBaseOverridden) notes.push("과세표준 수동조정");

  return {
    id: resolved.id,
    name: resolved.name,
    department: hrMeta.department,
    position: hrMeta.position,
    isOverseas: false,
    monthlyGross,
    nonTaxable,
    defaultTaxableBase,
    taxableBase,
    taxableBaseOverridden,
    employeePension: employee.pension,
    employeeHealth: employee.health,
    employeeLongTermCare: employee.longTermCare,
    employeeEmployment: employee.employment,
    employeeInsuranceTotal: employee.total,
    incomeTax,
    localIncomeTax,
    incomeTaxRelief,
    youthReliefEligible: youthEligible,
    totalDeductions,
    netPay,
    employerPension: employer.pensionEmployer,
    employerHealth: employer.healthEmployer,
    employerLongTermCare: employer.longTermCareEmployer,
    employerEmployment: employer.employmentEmployer,
    employerIndustrial: employer.industrialAccidentEmployer,
    employerInsuranceTotal: employer.totalEmployerContributions,
    totalEmployerCost: monthlyGross + employer.totalEmployerContributions,
    note: notes.join(" · "),
  };
}

function sumRows(rows: PayrollLedgerRow[]): PayrollLedgerSummary {
  return rows.reduce<PayrollLedgerSummary>(
    (acc, row) => ({
      domesticCount: acc.domesticCount + (row.isOverseas ? 0 : 1),
      overseasCount: acc.overseasCount + (row.isOverseas ? 1 : 0),
      grossTotal: acc.grossTotal + row.monthlyGross,
      basicPayTotal: acc.basicPayTotal + row.defaultTaxableBase,
      nonTaxableTotal: acc.nonTaxableTotal + row.nonTaxable,
      taxableBaseTotal: acc.taxableBaseTotal + row.taxableBase,
      employeeInsuranceTotal:
        acc.employeeInsuranceTotal + row.employeeInsuranceTotal,
      incomeTaxTotal: acc.incomeTaxTotal + row.incomeTax,
      localIncomeTaxTotal: acc.localIncomeTaxTotal + row.localIncomeTax,
      incomeTaxReliefTotal: acc.incomeTaxReliefTotal + row.incomeTaxRelief,
      totalDeductions: acc.totalDeductions + row.totalDeductions,
      netPayTotal: acc.netPayTotal + row.netPay,
      employerInsuranceTotal:
        acc.employerInsuranceTotal + row.employerInsuranceTotal,
      totalEmployerCost: acc.totalEmployerCost + row.totalEmployerCost,
    }),
    {
      domesticCount: 0,
      overseasCount: 0,
      basicPayTotal: 0,
      grossTotal: 0,
      nonTaxableTotal: 0,
      taxableBaseTotal: 0,
      employeeInsuranceTotal: 0,
      incomeTaxTotal: 0,
      localIncomeTaxTotal: 0,
      incomeTaxReliefTotal: 0,
      totalDeductions: 0,
      netPayTotal: 0,
      employerInsuranceTotal: 0,
      totalEmployerCost: 0,
    }
  );
}

export function buildPayrollLedger(
  yearMonth: string,
  personnel: PersonnelEntry[],
  taxableOverrides: Record<string, number> = {},
  hrByName: Record<string, { department: string; position: string }> = {},
  companyId: PayrollCompanyId = "bluebridge"
): PayrollLedgerResult {
  const domestic: PayrollLedgerRow[] = [];
  const filtered = filterPersonnelByPayrollCompany(personnel, companyId);

  for (const entry of filtered) {
    const hrMeta = hrByName[entry.name] ?? { department: "", position: "" };
    domestic.push(
      buildDomesticRow(entry, hrMeta, taxableOverrides[entry.id])
    );
  }

  return {
    yearMonth,
    companyId,
    companyLabel: getPayrollCompanyLabel(companyId),
    domestic,
    overseas: [],
    summary: sumRows(domestic),
  };
}
