import {
  calcEmployeeInsuranceBreakdown,
  calcLocalIncomeTaxFromIncomeTax,
  calcMonthlyWithholdingTaxFromInsuranceBase,
  type EmployeeInsuranceBreakdown,
} from "@/lib/income-tax-2026";
import { getMonthlyNonTaxableAllowance } from "@/lib/non-taxable-allowance";
import {
  isEmploymentInsuranceExempt,
  isOnPayrollForMonth,
  isOverseasTeam,
  type PersonnelEntry,
} from "@/lib/personnel";
import { buildPayrollRowNote } from "@/lib/payroll-personnel-notes";
import { applyPersonnelReferenceSalary } from "@/lib/personnel-reference-salaries";
import {
  calcEmployerContributionsFromInsuranceBase,
  JUN_2026_INSURANCE_LABEL,
  monthlyGrossFromSalary,
  truncateGoldfenderHealthLtc,
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

/** 성과급·인센티브 변동 — 보험은 기본급여(변동급 제외), 세금은 과세표준 */
export const VARIABLE_PAY_PERSONNEL_NAMES = [
  "성수린",
  "김소연",
  "니키",
  "정수민",
] as const;

export function isVariablePayPersonnel(name: string): boolean {
  return (VARIABLE_PAY_PERSONNEL_NAMES as readonly string[]).includes(name);
}

/** 4대보험 보수월액 = 기본급여 − 비과세 (성과급 미반영) */
function getInsuranceRemunerationBase(
  baseMonthlyGross: number,
  nonTaxable: number
): number {
  return Math.max(0, baseMonthlyGross - nonTaxable);
}

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
  companyId: PayrollCompanyId,
  yearMonth?: string
): PersonnelEntry[] {
  return personnel.filter((entry) => {
    if (isOverseasTeam(entry.name)) return false;
    if (yearMonth && !isOnPayrollForMonth(entry.name, yearMonth)) return false;
    return getPayrollCompanyForPerson(entry.name) === companyId;
  });
}

export interface PayrollLedgerRow {
  id: string;
  name: string;
  department: string;
  position: string;
  isOverseas: boolean;
  /** 고정 기본급(성과급 제외) */
  baseMonthlyGross: number;
  /** 당월 성과급 */
  performancePay: number;
  monthlyGross: number;
  nonTaxable: number;
  defaultTaxableBase: number;
  taxableBase: number;
  taxableBaseOverridden: boolean;
  /** 4대보험 산정 보수월액 */
  insuranceRemunerationBase: number;
  usesSplitPayrollCalc: boolean;
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
  /** 사용자가 비고를 직접 수정했는지 */
  noteOverridden: boolean;
}

/** 기본급여 (성과급 제외 고정 월급) */
export function getBasicPay(row: PayrollLedgerRow): number {
  return row.baseMonthlyGross;
}

/** 총지급액 (세전 월급) */
export function getTotalGrossPay(row: PayrollLedgerRow): number {
  return row.monthlyGross;
}

export interface PayrollLedgerSummary {
  domesticCount: number;
  overseasCount: number;
  basicPayTotal: number;
  performancePayTotal: number;
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

/** 골드펜더: 건강·장기요양만 십원 미만 절사 */
function applyGoldfenderHealthLtcTruncate(
  employee: EmployeeInsuranceBreakdown,
  employer: ReturnType<typeof calcEmployerContributionsFromInsuranceBase>
): {
  employee: EmployeeInsuranceBreakdown;
  employer: ReturnType<typeof calcEmployerContributionsFromInsuranceBase>;
} {
  const health = truncateGoldfenderHealthLtc(employee.health);
  const longTermCare = truncateGoldfenderHealthLtc(employee.longTermCare);
  const healthEmployer = truncateGoldfenderHealthLtc(employer.healthEmployer);
  const longTermCareEmployer = truncateGoldfenderHealthLtc(
    employer.longTermCareEmployer
  );

  return {
    employee: {
      ...employee,
      health,
      longTermCare,
      total:
        employee.pension + health + longTermCare + employee.employment,
    },
    employer: {
      ...employer,
      healthEmployer,
      longTermCareEmployer,
      totalEmployerContributions:
        employer.pensionEmployer +
        healthEmployer +
        longTermCareEmployer +
        employer.employmentEmployer +
        employer.industrialAccidentEmployer,
    },
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
  const localIncomeTaxBeforeRelief = calcLocalIncomeTaxFromIncomeTax(
    incomeTaxBeforeRelief
  );

  const incomeTaxRelief = Math.min(
    Math.floor(incomeTaxBeforeRelief * 0.9),
    Math.floor(2_000_000 / 12)
  );
  const incomeTaxAfterRelief = Math.max(
    0,
    incomeTaxBeforeRelief - incomeTaxRelief
  );
  const localIncomeTaxAfterRelief =
    calcLocalIncomeTaxFromIncomeTax(incomeTaxAfterRelief);
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
  performancePayOverride = 0,
  noteOverride?: string,
  companyId: PayrollCompanyId = "bluebridge"
): PayrollLedgerRow {
  const resolved = resolvePersonnelForPayroll(entry);
  const nonTaxable = getMonthlyNonTaxableAllowance(resolved.name);
  const baseMonthlyGross =
    resolved.inputMode === "salary" && resolved.salaryAmount > 0
      ? monthlyGrossFromSalary(resolved.salaryAmount, resolved.salaryBasis)
      : resolved.directMonthlyAmount;

  const usesSplitPayrollCalc = isVariablePayPersonnel(resolved.name);
  const performancePay = usesSplitPayrollCalc
    ? Math.max(0, Math.floor(performancePayOverride))
    : 0;
  const monthlyGross = usesSplitPayrollCalc
    ? baseMonthlyGross + performancePay
    : baseMonthlyGross;

  const defaultTaxableBase = Math.max(0, monthlyGross - nonTaxable);
  const taxableBase = defaultTaxableBase;

  const insuranceRemunerationBase = getInsuranceRemunerationBase(
    baseMonthlyGross,
    nonTaxable
  );

  const employmentExempt = isEmploymentInsuranceExempt(resolved.name);
  let employee = calcEmployeeInsuranceBreakdown(insuranceRemunerationBase);
  let employer = calcEmployerContributionsFromInsuranceBase(
    insuranceRemunerationBase
  );
  if (companyId === "goldfender") {
    ({ employee, employer } = applyGoldfenderHealthLtcTruncate(
      employee,
      employer
    ));
  }
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
    localIncomeTax = calcLocalIncomeTaxFromIncomeTax(incomeTax);
    netPay = monthlyGross - employee.total - incomeTax - localIncomeTax;
  }

  const totalDeductions = employee.total + incomeTax + localIncomeTax;
  const notes: string[] = [];
  if (employmentExempt) notes.push("고용보험 미가입");
  if (youthEligible) notes.push("청년소득세 90% 감면");

  const noteOverridden = noteOverride !== undefined;
  const note = noteOverridden
    ? noteOverride.trim()
    : buildPayrollRowNote(notes, resolved.name);

  return {
    id: resolved.id,
    name: resolved.name,
    department: hrMeta.department,
    position: hrMeta.position,
    isOverseas: false,
    baseMonthlyGross,
    performancePay,
    monthlyGross,
    nonTaxable,
    defaultTaxableBase,
    taxableBase,
    taxableBaseOverridden: false,
    insuranceRemunerationBase,
    usesSplitPayrollCalc,
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
    note,
    noteOverridden,
  };
}

function sumRows(rows: PayrollLedgerRow[]): PayrollLedgerSummary {
  return rows.reduce<PayrollLedgerSummary>(
    (acc, row) => ({
      domesticCount: acc.domesticCount + (row.isOverseas ? 0 : 1),
      overseasCount: acc.overseasCount + (row.isOverseas ? 1 : 0),
      grossTotal: acc.grossTotal + row.monthlyGross,
      performancePayTotal: acc.performancePayTotal + row.performancePay,
      basicPayTotal: acc.basicPayTotal + getBasicPay(row),
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
      performancePayTotal: 0,
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
  hrByName: Record<string, { department: string; position: string }> = {},
  companyId: PayrollCompanyId = "bluebridge",
  performancePayOverrides: Record<string, number> = {},
  noteOverrides: Record<string, string> = {}
): PayrollLedgerResult {
  const domestic: PayrollLedgerRow[] = [];
  const filtered = filterPersonnelByPayrollCompany(
    personnel,
    companyId,
    yearMonth
  );

  for (const entry of filtered) {
    const hrMeta = hrByName[entry.name] ?? { department: "", position: "" };
    domestic.push(
      buildDomesticRow(
        entry,
        hrMeta,
        performancePayOverrides[entry.id] ?? 0,
        noteOverrides[entry.id],
        companyId
      )
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
