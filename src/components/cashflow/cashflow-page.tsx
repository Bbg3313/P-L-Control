"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFinancial } from "@/contexts/financial-context";
import { CashflowExpenseMix } from "@/components/cashflow/cashflow-expense-mix";
import { CashflowExpenseTiming } from "@/components/cashflow/cashflow-expense-timing";
import { CashflowGapOverview } from "@/components/cashflow/cashflow-gap-overview";
import {
  buildCheckpoints,
  emptyExpenseRow,
  emptyHospitalRow,
  emptyMiscRow,
  summarizeMonth,
} from "@/lib/cashflow-calc";
import {
  buildMonthFromTemplates,
  withSeedHospitalsIfEmpty,
} from "@/lib/cashflow-seed-apply";
import {
  payrollSourceYearMonth,
  resolvePayrollLinkedAmount,
} from "@/lib/cashflow-payroll-expenses";
import {
  loadCashflowLocal,
  saveCashflowLocal,
} from "@/lib/cashflow-local";
import {
  CASHFLOW_START_MONTH,
  CONTRACT_STATUS_OPTIONS,
  createEmptyCashflow,
  newId,
  type CashflowMonth,
  type CashflowSnapshot,
  type ContractStatus,
  type ExpenseMonthRow,
  type HospitalMonthRow,
  type MiscCollectionRow,
} from "@/lib/cashflow-types";
import { formatCurrency, normalizeAmountInputString } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/calculations";
import { cn } from "@/lib/utils";

function parseMoney(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Math.floor(Number(digits));
}

function MoneyInput({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(
    value > 0 ? normalizeAmountInputString(String(value)) : ""
  );

  useEffect(() => {
    setText(value > 0 ? normalizeAmountInputString(String(value)) : "");
  }, [value]);

  return (
    <Input
      inputMode="numeric"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "min-w-0 overflow-visible text-right tabular-nums tracking-tight",
        className
      )}
      value={text}
      onChange={(e) => {
        const next = normalizeAmountInputString(e.target.value);
        setText(next);
        onChange(parseMoney(next));
      }}
      placeholder="0"
    />
  );
}

/** 한글 IME·매 키 저장으로 입력이 깨지지 않게 로컬 초안 후 blur 반영 */
function DraftTextInput({
  value,
  onCommit,
  className,
  placeholder,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <input
      value={draft}
      placeholder={placeholder}
      className={cn(
        "h-8 min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 text-sm text-slate-900 outline-none ring-offset-0 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300",
        className
      )}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function ensureMonth(
  snapshot: CashflowSnapshot,
  yearMonth: string,
  performancePayOverrides: Record<string, number> = {}
): CashflowMonth {
  const existing = snapshot.months[yearMonth];
  if (existing) return existing;
  return buildMonthFromTemplates(
    snapshot,
    yearMonth,
    performancePayOverrides
  );
}

export function CashflowPage() {
  const {
    reportingMonth,
    setReportingMonth,
    hydrated: monthHydrated,
  } = useFinancial();
  const [snapshot, setSnapshot] = useState<CashflowSnapshot>(
    createEmptyCashflow
  );
  const [hydrated, setHydrated] = useState(false);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [perfOverrides, setPerfOverrides] = useState<Record<string, number>>(
    {}
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirstSave = useRef(true);

  const cashflowMonth =
    reportingMonth < CASHFLOW_START_MONTH
      ? CASHFLOW_START_MONTH
      : reportingMonth;

  useEffect(() => {
    if (!monthHydrated) return;
    if (reportingMonth < CASHFLOW_START_MONTH) {
      setReportingMonth(CASHFLOW_START_MONTH);
    }
  }, [monthHydrated, reportingMonth, setReportingMonth]);

  const month = useMemo(
    () => ensureMonth(snapshot, cashflowMonth, perfOverrides),
    [snapshot, cashflowMonth, perfOverrides]
  );

  const summary = useMemo(() => summarizeMonth(month), [month]);
  const checkpoints = useMemo(() => buildCheckpoints(month), [month]);
  const hospitalsByDay = useMemo(() => {
    return [...month.hospitals].sort((a, b) => {
      const da = a.expectedDay ?? 99;
      const db = b.expectedDay ?? 99;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [month.hospitals]);

  const miscByDay = useMemo(() => {
    return [...(month.miscCollections ?? [])].sort((a, b) => {
      const da = a.expectedDay ?? 99;
      const db = b.expectedDay ?? 99;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [month.miscCollections]);

  const miscPaidCount = useMemo(
    () =>
      (month.miscCollections ?? []).filter((r) => r.status === "paid").length,
    [month.miscCollections]
  );

  const persistMonth = useCallback(
    (nextMonth: CashflowMonth) => {
      setSnapshot((prev) => {
        const next: CashflowSnapshot = {
          ...prev,
          months: { ...prev.months, [cashflowMonth]: nextMonth },
          updatedAt: new Date().toISOString(),
        };
        return next;
      });
    },
    [cashflowMonth]
  );

  // 보고월 없으면 생성, 비용 템플릿이 월에 빠져 있으면 보강
  useEffect(() => {
    if (!hydrated) return;
    setSnapshot((prev) => {
      const templates =
        prev.expenseTemplates.length > 0
          ? prev.expenseTemplates
          : [];
      let current = prev.months[cashflowMonth];
      if (!current) {
        current = ensureMonth(prev, cashflowMonth, perfOverrides);
      }
      const existingIds = new Set(current.expenses.map((e) => e.id));
      const missing = templates.filter((t) => !existingIds.has(t.id));
      if (prev.months[cashflowMonth] && missing.length === 0) return prev;

      const extras = missing.map((t) => {
        const linked = resolvePayrollLinkedAmount(
          t.source,
          cashflowMonth,
          perfOverrides
        );
        return emptyExpenseRow(
          t.id,
          t.name,
          linked ?? t.defaultAmount,
          t.payDay,
          t.source,
          t.dailyAmount
        );
      });
      return {
        ...prev,
        months: {
          ...prev.months,
          [cashflowMonth]: {
            ...current,
            expenses: [...current.expenses, ...extras],
          },
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, [hydrated, cashflowMonth, perfOverrides]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const local = loadCashflowLocal();
      let perfAll: Record<string, Record<string, number>> = {};
      try {
        const ovRes = await fetch("/api/payroll/overrides");
        if (ovRes.ok) {
          const ov = (await ovRes.json()) as {
            performancePay?: Record<string, Record<string, number>>;
          };
          perfAll = ov.performancePay ?? {};
        }
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch("/api/cashflow");
        if (res.ok) {
          const data = (await res.json()) as CashflowSnapshot & {
            _meta?: { storageConfigured?: boolean };
          };
          const { _meta, ...rest } = data;
          if (!cancelled) {
            setCloudEnabled(Boolean(_meta?.storageConfigured));
            const cloud: CashflowSnapshot = {
              hospitals: rest.hospitals ?? [],
              expenseTemplates: rest.expenseTemplates ?? [],
              months: rest.months ?? {},
              seedVersion: rest.seedVersion,
              updatedAt: rest.updatedAt ?? new Date().toISOString(),
            };
            const hasCloud =
              cloud.hospitals.length > 0 ||
              cloud.expenseTemplates.length > 0 ||
              Object.keys(cloud.months).length > 0;
            const chosen = withSeedHospitalsIfEmpty(
              hasCloud ? cloud : local,
              perfAll
            );
            setSnapshot(chosen);
            saveCashflowLocal(chosen);
            setPerfOverrides(
              perfAll[payrollSourceYearMonth(cashflowMonth)] ?? {}
            );
          }
        } else if (!cancelled) {
          const seeded = withSeedHospitalsIfEmpty(local, perfAll);
          setSnapshot(seeded);
          saveCashflowLocal(seeded);
          setPerfOverrides(
            perfAll[payrollSourceYearMonth(cashflowMonth)] ?? {}
          );
        }
      } catch {
        if (!cancelled) {
          const seeded = withSeedHospitalsIfEmpty(local, perfAll);
          setSnapshot(seeded);
          saveCashflowLocal(seeded);
          setPerfOverrides(
            perfAll[payrollSourceYearMonth(cashflowMonth)] ?? {}
          );
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          skipFirstSave.current = true;
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    async function loadMonthOverrides() {
      try {
        const ovRes = await fetch("/api/payroll/overrides");
        if (!ovRes.ok) return;
        const ov = (await ovRes.json()) as {
          performancePay?: Record<string, Record<string, number>>;
        };
        if (!cancelled) {
          setPerfOverrides(
            ov.performancePay?.[payrollSourceYearMonth(cashflowMonth)] ?? {}
          );
        }
      } catch {
        /* ignore */
      }
    }
    void loadMonthOverrides();
    return () => {
      cancelled = true;
    };
  }, [hydrated, cashflowMonth]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    saveCashflowLocal(snapshot);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!cloudEnabled) {
        setSaveState("saved");
        return;
      }
      setSaveState("saving");
      setError(null);
      try {
        const res = await fetch("/api/cashflow", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(data.error ?? "저장 실패");
          setSaveState("error");
          return;
        }
        setSaveState("saved");
      } catch {
        setError("저장 요청 실패");
        setSaveState("error");
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [snapshot, hydrated, cloudEnabled]);

  function updateHospital(id: string, patch: Partial<HospitalMonthRow>) {
    const hospitals = month.hospitals.map((row) =>
      row.id === id ? { ...row, ...patch } : row
    );
    persistMonth({ ...month, hospitals });
  }

  function setHospitalExpectedDay(id: string, expectedDay: number | null) {
    updateHospital(id, { expectedDay });
    setSnapshot((prev) => ({
      ...prev,
      hospitals: prev.hospitals.map((h) =>
        h.id === id ? { ...h, expectedDay } : h
      ),
    }));
  }

  function updateExpense(id: string, patch: Partial<ExpenseMonthRow>) {
    const expenses = month.expenses.map((row) =>
      row.id === id ? { ...row, ...patch } : row
    );
    persistMonth({ ...month, expenses });
  }

  function addHospital() {
    const id = newId("h");
    setSnapshot((prev) => ({
      ...prev,
      hospitals: [
        ...prev.hospitals,
        {
          id,
          name: "새 병원",
          defaultAmount: 0,
          expectedDay: null,
          contractStatus: "외주",
        },
      ],
      months: {
        ...prev.months,
        [cashflowMonth]: {
          ...month,
          hospitals: [
            ...month.hospitals,
            emptyHospitalRow(id, "새 병원", 0, "외주", 10),
          ],
        },
      },
      updatedAt: new Date().toISOString(),
    }));
  }

  function setContractStatus(id: string, contractStatus: ContractStatus) {
    setSnapshot((prev) => ({
      ...prev,
      hospitals: prev.hospitals.map((h) =>
        h.id === id ? { ...h, contractStatus } : h
      ),
      months: Object.fromEntries(
        Object.entries(prev.months).map(([ym, m]) => [
          ym,
          {
            ...m,
            hospitals: m.hospitals.map((h) =>
              h.id === id ? { ...h, contractStatus } : h
            ),
          },
        ])
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function removeHospital(id: string) {
    setSnapshot((prev) => {
      const months = { ...prev.months };
      for (const [ym, m] of Object.entries(months)) {
        months[ym] = {
          ...m,
          hospitals: m.hospitals.filter((h) => h.id !== id),
        };
      }
      return {
        ...prev,
        hospitals: prev.hospitals.filter((h) => h.id !== id),
        months,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function updateMisc(id: string, patch: Partial<MiscCollectionRow>) {
    const miscCollections = (month.miscCollections ?? []).map((row) =>
      row.id === id ? { ...row, ...patch } : row
    );
    persistMonth({ ...month, miscCollections });
  }

  function addMisc() {
    persistMonth({
      ...month,
      miscCollections: [
        ...(month.miscCollections ?? []),
        emptyMiscRow(newId("misc"), "", 0, 10),
      ],
    });
  }

  function removeMisc(id: string) {
    persistMonth({
      ...month,
      miscCollections: (month.miscCollections ?? []).filter(
        (row) => row.id !== id
      ),
    });
  }

  function addExpense() {
    const id = newId("e");
    setSnapshot((prev) => ({
      ...prev,
      expenseTemplates: [
        ...prev.expenseTemplates,
        {
          id,
          name: "새 비용",
          defaultAmount: 0,
          payDay: 10,
          source: "manual",
        },
      ],
      months: {
        ...prev.months,
        [cashflowMonth]: {
          ...month,
          expenses: [
            ...month.expenses,
            emptyExpenseRow(id, "새 비용", 0, 10, "manual"),
          ],
        },
      },
      updatedAt: new Date().toISOString(),
    }));
  }

  function syncPayrollExpenses() {
    const expenses = month.expenses.map((row) => {
      const linked = resolvePayrollLinkedAmount(
        row.source,
        cashflowMonth,
        perfOverrides
      );
      if (linked == null) return row;
      return {
        ...row,
        amount: linked,
        paidAmount: 0,
        status: "unpaid" as const,
        ...(row.source === "meta-daily" ? { dailyAmount: 700_000 } : {}),
      };
    });
    const ids = new Set(expenses.map((e) => e.id));
    for (const t of snapshot.expenseTemplates) {
      if (ids.has(t.id)) continue;
      const linked = resolvePayrollLinkedAmount(
        t.source,
        cashflowMonth,
        perfOverrides
      );
      expenses.push(
        emptyExpenseRow(
          t.id,
          t.name,
          linked ?? t.defaultAmount,
          t.payDay,
          t.source,
          t.dailyAmount
        )
      );
    }
    persistMonth({ ...month, expenses });
  }

  function updateExpensePayDay(id: string, payDay: number | null) {
    const expenses = month.expenses.map((row) =>
      row.id === id ? { ...row, payDay } : row
    );
    persistMonth({ ...month, expenses });
    setSnapshot((prev) => ({
      ...prev,
      expenseTemplates: prev.expenseTemplates.map((e) =>
        e.id === id ? { ...e, payDay } : e
      ),
    }));
  }

  function removeExpense(id: string) {
    setSnapshot((prev) => {
      const months = { ...prev.months };
      for (const [ym, m] of Object.entries(months)) {
        months[ym] = {
          ...m,
          expenses: m.expenses.filter((e) => e.id !== id),
        };
      }
      return {
        ...prev,
        expenseTemplates: prev.expenseTemplates.filter((e) => e.id !== id),
        months,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function renameHospitalMaster(id: string, name: string) {
    setSnapshot((prev) => ({
      ...prev,
      hospitals: prev.hospitals.map((h) =>
        h.id === id ? { ...h, name } : h
      ),
      months: Object.fromEntries(
        Object.entries(prev.months).map(([ym, m]) => [
          ym,
          {
            ...m,
            hospitals: m.hospitals.map((h) =>
              h.id === id ? { ...h, name } : h
            ),
          },
        ])
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function setHospitalDefaultAmount(id: string, defaultAmount: number) {
    setSnapshot((prev) => ({
      ...prev,
      hospitals: prev.hospitals.map((h) =>
        h.id === id ? { ...h, defaultAmount } : h
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  if (!hydrated || !monthHydrated) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-1 overflow-hidden">
      {/* 헤더 + 현황 KPI + 기준일 현금흐름 */}
      <div className="shrink-0 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-base font-semibold text-slate-900">
              수금현황
            </h1>
            <span className="text-sm text-slate-500">
              {formatPeriodLabel(cashflowMonth)}
            </span>
            {saveState === "saving" && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                저장
              </span>
            )}
            {saveState === "saved" && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                저장됨
              </span>
            )}
            {saveState === "error" && error && (
              <span className="text-xs text-red-600">{error}</span>
            )}
          </div>
          <ReportingMonthNav showQuickMonths={false} />
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {(() => {
            const hospitalBilled = Math.max(
              0,
              summary.billedTotal - summary.miscBilledTotal
            );
            const hospitalReceived = Math.max(
              0,
              summary.receivedTotal - summary.miscReceivedTotal
            );
            const receivedPct =
              hospitalBilled > 0
                ? Math.round((hospitalReceived / hospitalBilled) * 100)
                : 0;
            const unpaidPct =
              hospitalBilled > 0
                ? Math.round((summary.unpaidTotal / hospitalBilled) * 100)
                : 0;
            const items: {
              label: string;
              value: number;
              tone: string;
              pct: number | null;
            }[] = [
              {
                label: "병원 수금",
                value: hospitalBilled,
                tone: "text-slate-900",
                pct: null,
              },
              {
                label: "수금",
                value: summary.receivedTotal,
                tone: "text-emerald-700",
                pct: receivedPct,
              },
              {
                label: "미수",
                value: summary.unpaidTotal,
                tone: "text-amber-700",
                pct: unpaidPct,
              },
              {
                label: "월 비용",
                value: summary.expenseTotal,
                tone: "text-slate-900",
                pct: null,
              },
            ];
            return items.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="text-[11px] font-medium text-slate-500">
                    {item.label}
                  </div>
                  {item.pct != null && (
                    <div
                      className={cn(
                        "text-[11px] font-semibold tabular-nums",
                        item.tone
                      )}
                    >
                      {item.pct}%
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    "mt-0.5 text-base font-semibold tabular-nums tracking-tight",
                    item.tone
                  )}
                >
                  {formatCurrency(item.value)}
                </div>
              </div>
            ));
          })()}
        </div>

        <div className="grid w-full gap-1.5 lg:grid-cols-2">
          <CashflowExpenseMix expenses={month.expenses} />
          <CashflowGapOverview
            checkpoints={checkpoints}
            expenseTotal={summary.expenseTotal}
          />
        </div>
      </div>

      {/* 월 비용 | 지출 시점 | 병원 수금 | 기타 수금 */}
      <div  className="grid min-h-0 flex-1 gap-0.5 overflow-hidden lg:grid-cols-4">
        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-100 px-2 py-1.5">
            <h2 className="text-sm font-semibold text-slate-800">
              월 비용
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                {formatCurrency(summary.expenseTotal)}
              </span>
            </h2>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-slate-200 px-2 text-xs"
                onClick={syncPayrollExpenses}
              >
                급여반영
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-slate-200 px-2 text-xs"
                onClick={addExpense}
              >
                + 추가
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {month.expenses.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-400">
                비용 없음
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {month.expenses.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-slate-50",
                      row.excluded && "bg-slate-50/80 opacity-60"
                    )}
                  >
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        updateExpense(row.id, { name: e.target.value })
                      }
                      className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-1"
                    />
                    <MoneyInput
                      value={row.amount}
                      onChange={(n) =>
                        updateExpense(row.id, {
                          amount: n,
                          paidAmount: 0,
                          status: "unpaid",
                        })
                      }
                      className="h-8 w-[7.5rem] shrink-0 border-slate-200 bg-white px-1.5 text-xs"
                      aria-label="금액"
                    />
                    {row.source === "meta-daily" ? (
                      <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md border border-sky-100 bg-sky-50 text-[10px] font-semibold text-sky-700">
                        매일
                      </span>
                    ) : (
                      <select
                        className="h-8 w-12 shrink-0 rounded-md border border-slate-200 bg-white px-0.5 text-[10px] font-semibold text-slate-700"
                        value={row.payDay ?? ""}
                        aria-label="지출일"
                        onChange={(e) => {
                          const v = e.target.value;
                          updateExpensePayDay(
                            row.id,
                            v === "" ? null : Number(v)
                          );
                        }}
                      >
                        <option value="">—</option>
                        <option value={1}>1</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={25}>25</option>
                        <option value={31}>말</option>
                        {[5, 15].map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className={cn(
                        "h-8 shrink-0 rounded-md border px-1.5 text-[10px] font-semibold",
                        row.excluded
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      )}
                      aria-label={row.excluded ? "현황에 포함" : "현황에서 제외"}
                      title={
                        row.excluded
                          ? "상단 현황에 다시 포함"
                          : "이번 달 안 나가면 상단 현황에서 제외"
                      }
                      onClick={() =>
                        updateExpense(row.id, { excluded: !row.excluded })
                      }
                    >
                      {row.excluded ? "제외됨" : "제외"}
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="삭제"
                      onClick={() => removeExpense(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <CashflowExpenseTiming
            expenses={month.expenses}
            yearMonth={month.yearMonth}
            className="min-h-0 flex-1 border-0"
          />
        </section>


        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-100 px-2 py-1.5">
            <h2 className="text-sm font-semibold text-slate-800">
              병원 수금
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                {summary.paidCount}/{summary.hospitalCount} 완료
              </span>
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-slate-200 px-2 text-xs"
              onClick={addHospital}
            >
              + 추가
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {hospitalsByDay.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-400">
                병원 없음
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {hospitalsByDay.map((row) => {
                  const inactive =
                    row.contractStatus === "보류" ||
                    row.contractStatus === "해지";
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-1.5 py-1",
                        inactive && "opacity-45",
                        !inactive &&
                          row.status === "paid" &&
                          "bg-emerald-50/70",
                        !inactive &&
                          row.status === "unpaid" &&
                          "bg-amber-50/50"
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "h-8 w-14 shrink-0 rounded-md text-xs font-bold",
                          row.status === "paid"
                            ? "bg-emerald-500 text-white"
                            : "bg-amber-400 text-amber-950"
                        )}
                        onClick={() =>
                          updateHospital(row.id, {
                            status: row.status === "paid" ? "unpaid" : "paid",
                          })
                        }
                      >
                        {row.status === "paid" ? "완료" : "미수"}
                      </button>
                      <Input
                        value={row.name}
                        onChange={(e) =>
                          renameHospitalMaster(row.id, e.target.value)
                        }
                        className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-1"
                      />
                      <select
                        className="h-8 w-16 shrink-0 rounded-md border border-slate-200 bg-white px-1 text-xs text-slate-600"
                        value={row.contractStatus}
                        aria-label="계약"
                        onChange={(e) =>
                          setContractStatus(
                            row.id,
                            e.target.value as ContractStatus
                          )
                        }
                      >
                        {CONTRACT_STATUS_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-8 w-14 shrink-0 rounded-md border border-slate-200 bg-white px-1 text-xs font-semibold text-slate-700"
                        value={row.expectedDay ?? ""}
                        aria-label="수금일"
                        onChange={(e) => {
                          const v = e.target.value;
                          setHospitalExpectedDay(
                            row.id,
                            v === "" ? null : Number(v)
                          );
                        }}
                      >
                        <option value="">—</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(
                          (d) => (
                            <option key={d} value={d}>
                              {d}일
                            </option>
                          )
                        )}
                      </select>
                      <MoneyInput
                        value={row.amount}
                        onChange={(n) => {
                          updateHospital(row.id, { amount: n });
                          setHospitalDefaultAmount(row.id, n);
                        }}
                        className="h-8 w-[7.5rem] shrink-0 border-slate-200 bg-white px-1.5 text-xs"
                      />
                      <button
                        type="button"
                        className="shrink-0 rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="삭제"
                        onClick={() => removeHospital(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-100 px-2 py-1.5">
            <h2 className="text-sm font-semibold text-slate-800">
              기타 수금
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                예상 추가매출 · {miscPaidCount}/{miscByDay.length} 입금 ·{" "}
                {formatCurrency(summary.miscBilledTotal)}
              </span>
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-slate-200 px-2 text-xs"
              onClick={addMisc}
            >
              + 추가
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {miscByDay.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-400">
                내역 없음 · + 추가
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {miscByDay.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-1.5 py-1",
                      row.status === "paid"
                        ? "bg-emerald-50/70"
                        : "bg-sky-50/70"
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "h-8 w-14 shrink-0 rounded-md text-xs font-bold",
                        row.status === "paid"
                          ? "bg-emerald-500 text-white"
                          : "bg-sky-500 text-white"
                      )}
                      onClick={() =>
                        updateMisc(row.id, {
                          status: row.status === "paid" ? "unpaid" : "paid",
                        })
                      }
                    >
                      {row.status === "paid" ? "입금" : "예상"}
                    </button>
                    <DraftTextInput
                      value={row.name}
                      onCommit={(name) => updateMisc(row.id, { name })}
                      placeholder="항목명"
                    />
                    <select
                      className="h-8 w-14 shrink-0 rounded-md border border-slate-200 bg-white px-1 text-xs font-semibold text-slate-700"
                      value={row.expectedDay ?? ""}
                      aria-label="예정일"
                      onChange={(e) => {
                        const v = e.target.value;
                        updateMisc(row.id, {
                          expectedDay: v === "" ? null : Number(v),
                        });
                      }}
                    >
                      <option value="">—</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}일
                        </option>
                      ))}
                    </select>
                    <MoneyInput
                      value={row.amount}
                      onChange={(n) => updateMisc(row.id, { amount: n })}
                      className="h-8 w-[7.5rem] shrink-0 border-slate-200 bg-white px-1.5 text-xs"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="삭제"
                      onClick={() => removeMisc(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
