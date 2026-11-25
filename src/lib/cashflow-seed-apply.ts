import {
  emptyExpenseRow,
  emptyHospitalRow,
} from "@/lib/cashflow-calc";
import {
  resolveHospitalMonthAmount,
  SEED_HOSPITALS,
} from "@/lib/cashflow-seed";
import {
  payrollSourceYearMonth,
  resolveLinkedExpenseAmount,
  SEED_EXPENSE_TEMPLATES,
} from "@/lib/cashflow-payroll-expenses";
import {
  CASHFLOW_SEED_VERSION,
  CASHFLOW_START_MONTH,
  type CashflowMonth,
  type CashflowSnapshot,
  type ExpenseMonthRow,
  type ExpenseSource,
  type HospitalMonthRow,
} from "@/lib/cashflow-types";

function expenseNote(source: ExpenseSource, name: string): string {
  switch (source) {
    case "payroll-bbg":
      return "전월 급여대장 실지급 (미지급 제외) · 10일";
    case "payroll-ceo":
      return "전월 급여대장 대표이사(이정석) 실지급 · 10일";
    case "payroll-goldfender":
      return "전월 급여대장 실지급 · 말일";
    case "fixed-th":
      return "고정 500만 · 말일";
    case "fixed-vn":
      return "고정 175만 · 말일";
    case "meta-daily":
      return "일 70만 카드 · 매일";
    default:
      if (name === "영업커미션") return "금액 직접 입력";
      if (name === "기타영업커미션") return "금액 직접 입력";
      if (name === "통역비") return "금액 직접 입력";
      if (name === "임대료") return "121만 · 1일";
      if (name === "관리비") return "50만 · 1일";
      if (name === "대출상환") return "500만 · 10일";
      if (name === "4대보험") return "400만 · 10일";
      if (name === "AI구독") return "100만 · 25일";
      if (name === "법인차량") return "210만 · 20일";
      if (name === "복합기") return "20만 · 25일";
      return "";
  }
}

/** 시드 병원·비용 적용 (버전 낮으면 갱신) */
export function withSeedHospitalsIfEmpty(
  snapshot: CashflowSnapshot,
  performancePayOverridesByMonth: Record<
    string,
    Record<string, number>
  > = {}
): CashflowSnapshot {
  const version = snapshot.seedVersion ?? 0;
  const monthsNeedExpenses = Object.values(snapshot.months).some(
    (m) => m.expenses.length < SEED_EXPENSE_TEMPLATES.length
  );
  if (
    version >= CASHFLOW_SEED_VERSION &&
    snapshot.hospitals.length > 0 &&
    snapshot.expenseTemplates.length >= SEED_EXPENSE_TEMPLATES.length &&
    !monthsNeedExpenses
  ) {
    return snapshot;
  }

  const hospitals = SEED_HOSPITALS.map((h) => ({ ...h }));
  const expenseTemplates = SEED_EXPENSE_TEMPLATES.map((e) => ({ ...e }));
  const months: Record<string, CashflowMonth> = {};

  const yearMonths = Object.keys(snapshot.months).filter(
    (ym) => ym >= CASHFLOW_START_MONTH
  );
  if (yearMonths.length === 0) {
    yearMonths.push(CASHFLOW_START_MONTH);
  }

  for (const ym of yearMonths) {
    const month = snapshot.months[ym];
    const prevH = new Map((month?.hospitals ?? []).map((h) => [h.id, h]));
    const prevE = new Map((month?.expenses ?? []).map((e) => [e.id, e]));
    const payrollYm = payrollSourceYearMonth(ym);
    const overrides = performancePayOverridesByMonth[payrollYm] ?? {};

    const nextHospitals: HospitalMonthRow[] = hospitals.map((h) => {
      const prev = prevH.get(h.id);
      const amount = resolveHospitalMonthAmount(
        h.id,
        ym,
        h.defaultAmount,
        prev?.amount
      );
      if (!prev) {
        return emptyHospitalRow(
          h.id,
          h.name,
          amount,
          h.contractStatus,
          h.expectedDay
        );
      }
      return {
        ...prev,
        name: h.name,
        contractStatus: h.contractStatus,
        expectedDay: prev.expectedDay ?? h.expectedDay,
        amount,
      };
    });

    const nextExpenses: ExpenseMonthRow[] = expenseTemplates.map((t) => {
      const prev = prevE.get(t.id);
      const linked = resolveLinkedExpenseAmount(t.source, ym, overrides);
      const isPayrollLinked =
        t.source === "payroll-bbg" ||
        t.source === "payroll-ceo" ||
        t.source === "payroll-goldfender";
      // 인건비는 전월 대장 기준으로 시드 갱신 시 재계산
      const amount =
        isPayrollLinked && linked != null
          ? linked
          : prev && prev.amount > 0
            ? prev.amount
            : (linked ?? t.defaultAmount);
      const dailyAmount = t.dailyAmount;
      if (!prev) {
        return {
          ...emptyExpenseRow(
            t.id,
            t.name,
            amount,
            t.payDay,
            t.source,
            dailyAmount
          ),
          note: expenseNote(t.source, t.name),
        };
      }
      const paidAmount = Math.min(
        amount,
        Math.max(0, Math.floor(prev.paidAmount || 0)) ||
          (prev.status === "paid" ? amount : 0)
      );
      return {
        ...prev,
        name: t.name,
        payDay: t.payDay,
        source: t.source,
        amount,
        paidAmount,
        status: amount > 0 && paidAmount >= amount ? "paid" : "unpaid",
        ...(dailyAmount ? { dailyAmount } : {}),
        note: prev.note || expenseNote(t.source, t.name),
      };
    });

    for (const e of month?.expenses ?? []) {
      if (nextExpenses.some((x) => x.id === e.id)) continue;
      nextExpenses.push(e);
    }

    months[ym] = {
      yearMonth: ym,
      hospitals: nextHospitals,
      expenses: nextExpenses,
      miscCollections: month?.miscCollections ?? [],
    };
  }

  return {
    ...snapshot,
    hospitals,
    expenseTemplates,
    months,
    seedVersion: CASHFLOW_SEED_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

export function buildMonthFromTemplates(
  snapshot: CashflowSnapshot,
  yearMonth: string,
  performancePayOverrides: Record<string, number> = {}
): CashflowMonth {
  const hospitals = snapshot.hospitals.map((h) =>
    emptyHospitalRow(
      h.id,
      h.name,
      resolveHospitalMonthAmount(h.id, yearMonth, h.defaultAmount),
      h.contractStatus,
      h.expectedDay
    )
  );
  const expenses = snapshot.expenseTemplates.map((t) => {
    // performancePayOverrides 는 호출측에서 전월(급여 귀속월) 기준으로 넘김
    const linked = resolveLinkedExpenseAmount(
      t.source,
      yearMonth,
      performancePayOverrides
    );
    return {
      ...emptyExpenseRow(
        t.id,
        t.name,
        linked ?? t.defaultAmount,
        t.payDay,
        t.source,
        t.dailyAmount
      ),
      note: expenseNote(t.source, t.name),
    };
  });
  return { yearMonth, hospitals, expenses, miscCollections: [] };
}
