import { normalizeCashflowSnapshot } from "@/lib/cashflow-normalize";
import {
  createEmptyCashflow,
  type CashflowSnapshot,
} from "@/lib/cashflow-types";

export const CASHFLOW_LOCAL_KEY = "pl-control-cashflow-v1";

export function loadCashflowLocal(): CashflowSnapshot {
  if (typeof window === "undefined") return createEmptyCashflow();
  try {
    const raw = localStorage.getItem(CASHFLOW_LOCAL_KEY);
    if (!raw) return createEmptyCashflow();
    return normalizeCashflowSnapshot(
      JSON.parse(raw) as Partial<CashflowSnapshot>
    );
  } catch {
    return createEmptyCashflow();
  }
}

export function saveCashflowLocal(snapshot: CashflowSnapshot): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CASHFLOW_LOCAL_KEY,
    JSON.stringify({
      ...snapshot,
      updatedAt: new Date().toISOString(),
    })
  );
}
