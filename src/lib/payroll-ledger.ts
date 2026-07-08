import {
  calcEmployeeInsuranceBreakdown,
  calcMonthlyWithholdingTaxFromInsuranceBase,
} from "@/lib/income-tax-2026";
import { getMonthlyNonTaxableAllowance } from "@/lib/non-taxable-allowance";
import {
  isOverseasTeam,
  type PersonnelEntry,
} from "@/lib/personnel";
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

/** 비용 페이지 미입력 시 급여대장 기본 연봉·월급 */
const PAYROLL_REFERENCE_SALARIES: Record<
  string,
  { mode: "salary" | "direct"; annual?: number; monthly?: number }
> = {
  성수린: { mode: "salary", annual: 57_000_000 },
  박양근: { mode: "salary", annual: 51_600_000 },
  안효재: { mode: "salary", annual: 34_000_000 },
  니키: { mode: "salary", annual: 35_000_000 },
  아리: { mode: "salary", annual: 30_000_000 },
  김소연: { mode: "salary", annual: 40_000_000 },
  정수민: { mode: "salary", annual: 27_000_000 },
};

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

export interface PayrollLedgerSummary {
  domesticCount: number;
  overseasCount: number;
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
  domestic: PayrollLedgerRow[];
  overseas: PayrollLedgerRow[];
  summary: PayrollLedgerSummary;
}

export function resolvePersonnelForPayroll(entry: PersonnelEntry): PersonnelEntry {
  if (
    entry.salaryAmount > 0 ||
    entry.directMonthlyAmount > 0 ||
    isOverseasTeam(entry.name)
  ) {
    return entry;
  }

  const ref = PAYROLL_REFERENCE_SALARIES[entry.name];
  if (!ref) return entry;

  if (ref.mode === "direct" && ref.monthly) {
    return {
      ...entry,
      inputMode: "direct",
      directMonthlyAmount: ref.monthly,
      salaryAmount: 0,
      salaryBasis: "monthly",
    };
  }

  if (ref.mode === "salary" && ref.annual) {
    return {
      ...entry,
      inputMode: "salary",
      salaryAmount: ref.annual,
      salaryBasis: "annual",
    };
  }

  return entry;
}

function calcYouthTaxFromInsuranceBase(
  monthlyGross: number,
  nonTaxableMonthly: number,
  insuranceBase: number
): YouthTaxReliefBreakdown | null {
  if (monthlyGross <= 0) return null;

  const employeeInsurance =
    calcEmployeeInsuranceBreakdown(insuranceBase).total;
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
    employeeInsurance -
    incomeTaxAfterRelief -
    localIncomeTaxAfterRelief;

  return {
    monthlyGross,
    nonTaxableMonthly,
    insuranceBase,
    employeeInsurance,
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

  const employee = calcEmployeeInsuranceBreakdown(taxableBase);
  const employer = calcEmployerContributionsFromInsuranceBase(taxableBase);
  const youthEligible = isYouthIncomeTaxReliefEligible(resolved.name);

  let incomeTax = 0;
  let localIncomeTax = 0;
  let incomeTaxRelief = 0;
  let netPay = monthlyGross;

  if (youthEligible) {
    const youth = calcYouthTaxFromInsuranceBase(
      monthlyGross,
      nonTaxable,
      taxableBase
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
  hrByName: Record<string, { department: string; position: string }> = {}
): PayrollLedgerResult {
  const domestic: PayrollLedgerRow[] = [];

  for (const entry of personnel) {
    if (isOverseasTeam(entry.name)) continue;
    const hrMeta = hrByName[entry.name] ?? { department: "", position: "" };
    domestic.push(
      buildDomesticRow(entry, hrMeta, taxableOverrides[entry.id])
    );
  }

  return {
    yearMonth,
    domestic,
    overseas: [],
    summary: sumRows(domestic),
  };
}
