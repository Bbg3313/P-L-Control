"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFinancial } from "@/contexts/financial-context";
import {
  buildCheckpoints,
  emptyExpenseRow,
  emptyHospitalRow,
  summarizeMonth,
} from "@/lib/cashflow-calc";
import {
  buildMonthFromTemplates,
  withSeedHospitalsIfEmpty,
} from "@/lib/cashflow-seed-apply";
import { resolvePayrollLinkedAmount } from "@/lib/cashflow-payroll-expenses";
import {
  loadCashflowLocal,
  saveCashflowLocal,
} from "@/lib/cashflow-local";
import {
  CONTRACT_STATUS_OPTIONS,
  createEmptyCashflow,
  newId,
  type CashflowMonth,
  type CashflowSnapshot,
  type ContractStatus,
  type ExpenseMonthRow,
  type HospitalMonthRow,
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
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
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
      className={cn("text-right tabular-nums", className)}
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
  const { reportingMonth, hydrated: monthHydrated } = useFinancial();
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

  const month = useMemo(
    () => ensureMonth(snapshot, reportingMonth, perfOverrides),
    [snapshot, reportingMonth, perfOverrides]
  );

  const summary = useMemo(() => summarizeMonth(month), [month]);
  const checkpoints = useMemo(() => buildCheckpoints(month), [month]);

  const persistMonth = useCallback(
    (nextMonth: CashflowMonth) => {
      setSnapshot((prev) => {
        const next: CashflowSnapshot = {
          ...prev,
          months: { ...prev.months, [reportingMonth]: nextMonth },
          updatedAt: new Date().toISOString(),
        };
        return next;
      });
    },
    [reportingMonth]
  );

  // 보고월 없으면 생성, 비용 템플릿이 월에 빠져 있으면 보강
  useEffect(() => {
    if (!hydrated) return;
    setSnapshot((prev) => {
      const templates =
        prev.expenseTemplates.length > 0
          ? prev.expenseTemplates
          : [];
      let current = prev.months[reportingMonth];
      if (!current) {
        current = ensureMonth(prev, reportingMonth, perfOverrides);
      }
      const existingIds = new Set(current.expenses.map((e) => e.id));
      const missing = templates.filter((t) => !existingIds.has(t.id));
      if (prev.months[reportingMonth] && missing.length === 0) return prev;

      const extras = missing.map((t) => {
        const linked = resolvePayrollLinkedAmount(
          t.source,
          reportingMonth,
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
          [reportingMonth]: {
            ...current,
            expenses: [...current.expenses, ...extras],
          },
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, [hydrated, reportingMonth, perfOverrides]);

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
            setPerfOverrides(perfAll[reportingMonth] ?? {});
          }
        } else if (!cancelled) {
          const seeded = withSeedHospitalsIfEmpty(local, perfAll);
          setSnapshot(seeded);
          saveCashflowLocal(seeded);
          setPerfOverrides(perfAll[reportingMonth] ?? {});
        }
      } catch {
        if (!cancelled) {
          const seeded = withSeedHospitalsIfEmpty(local, perfAll);
          setSnapshot(seeded);
          saveCashflowLocal(seeded);
          setPerfOverrides(perfAll[reportingMonth] ?? {});
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
          setPerfOverrides(ov.performancePay?.[reportingMonth] ?? {});
        }
      } catch {
        /* ignore */
      }
    }
    void loadMonthOverrides();
    return () => {
      cancelled = true;
    };
  }, [hydrated, reportingMonth]);

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
        [reportingMonth]: {
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
        [reportingMonth]: {
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
        reportingMonth,
        perfOverrides
      );
      if (linked == null) return row;
      return {
        ...row,
        amount: linked,
        ...(row.source === "meta-daily" ? { dailyAmount: 700_000 } : {}),
      };
    });
    const ids = new Set(expenses.map((e) => e.id));
    for (const t of snapshot.expenseTemplates) {
      if (ids.has(t.id)) continue;
      const linked = resolvePayrollLinkedAmount(
        t.source,
        reportingMonth,
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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-1.5 overflow-hidden">
      {/* 헤더 + KPI + 기준일 — 한 덩어리로 얇게 */}
      <div className="shrink-0 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <h1 className="text-sm font-semibold text-slate-900">
              영업이익 · 수금현황
            </h1>
            <span className="text-slate-500">
              {formatPeriodLabel(reportingMonth)}
            </span>
            <span className="tabular-nums text-slate-600">
              청구 {formatCurrency(summary.billedTotal)}
            </span>
            <span className="tabular-nums text-emerald-700">
              수금 {formatCurrency(summary.receivedTotal)}
            </span>
            <span className="tabular-nums text-amber-700">
              미수 {formatCurrency(summary.unpaidTotal)}
            </span>
            <span className="tabular-nums text-slate-600">
              비용 {formatCurrency(summary.expenseTotal)}
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                summary.operatingProfit >= 0
                  ? "text-emerald-700"
                  : "text-red-600"
              )}
            >
              이익 {formatCurrency(summary.operatingProfit)}
            </span>
            {saveState === "saving" && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                저장
              </span>
            )}
            {saveState === "saved" && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                저장됨
              </span>
            )}
          </div>
          <ReportingMonthNav showQuickMonths={false} />
        </div>

        <div className="flex flex-wrap gap-1 text-[11px]">
          {checkpoints.map((cp) => (
            <div
              key={cp.key}
              className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1"
            >
              <span className="font-semibold text-slate-700">{cp.label}</span>
              <span className="tabular-nums text-slate-500">
                수금 {formatCurrency(cp.received)}
              </span>
              <span className="tabular-nums text-slate-500">
                비용 {formatCurrency(cp.expenses)}
              </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  cp.net >= 0 ? "text-emerald-700" : "text-red-600"
                )}
              >
                {formatCurrency(cp.net)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 비용 | 병원 수금 — 좌우 분할, 스크롤 없이 한 화면 */}
      <div className="grid min-h-0 flex-1 gap-1.5 overflow-hidden lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-100 px-2 py-1">
            <h2 className="text-xs font-semibold text-slate-800">
              월 비용
              <span className="ml-1 font-normal text-slate-500">
                {formatCurrency(summary.expenseTotal)}
              </span>
            </h2>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-5 border-slate-200 px-1.5 text-[10px]"
                onClick={syncPayrollExpenses}
              >
                급여반영
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-5 border-slate-200 px-1.5 text-[10px]"
                onClick={addExpense}
              >
                +
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {month.expenses.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-slate-400">
                비용 없음
              </p>
            ) : (
              <div className="space-y-0.5">
                {month.expenses.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-50"
                  >
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        updateExpense(row.id, { name: e.target.value })
                      }
                      className="h-5 min-w-0 flex-1 border-0 bg-transparent px-0.5 text-[11px] shadow-none focus-visible:ring-1"
                    />
                    <MoneyInput
                      value={row.amount}
                      onChange={(n) => updateExpense(row.id, { amount: n })}
                      className="h-5 w-[5.5rem] shrink-0 border-slate-200 bg-white px-1 text-[11px]"
                    />
                    {row.source === "meta-daily" ? (
                      <span className="w-7 shrink-0 text-center text-[10px] text-sky-700">
                        매일
                      </span>
                    ) : (
                      <select
                        className="h-5 w-9 shrink-0 rounded border border-slate-200 bg-white text-[10px]"
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
                      className="shrink-0 text-slate-300 hover:text-slate-600"
                      aria-label="삭제"
                      onClick={() => removeExpense(row.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-100 px-2 py-1">
            <h2 className="text-xs font-semibold text-slate-800">
              병원 수금
              <span className="ml-1 font-normal text-slate-500">
                {summary.paidCount}/{summary.hospitalCount} 완료
              </span>
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-5 border-slate-200 px-1.5 text-[10px]"
              onClick={addHospital}
            >
              +
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {month.hospitals.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-slate-400">
                병원 없음
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-0.5 xl:grid-cols-2">
                {month.hospitals.map((row) => {
                  const inactive =
                    row.contractStatus === "보류" ||
                    row.contractStatus === "해지";
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        "flex items-center gap-1 rounded px-1 py-0.5",
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
                          "h-5 w-10 shrink-0 rounded text-[10px] font-semibold",
                          row.status === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
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
                        className="h-5 min-w-0 flex-1 border-0 bg-transparent px-0.5 text-[11px] shadow-none focus-visible:ring-1"
                      />
                      <select
                        className="h-5 w-[3.25rem] shrink-0 rounded border-0 bg-transparent text-[10px] text-slate-500"
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
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-5 w-8 shrink-0 rounded border-0 bg-transparent text-[10px] text-slate-500"
                        value={row.expectedDay ?? ""}
                        aria-label="예정일"
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
                              {d}
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
                        className="h-5 w-[5.25rem] shrink-0 border-slate-200 bg-white px-1 text-[11px]"
                      />
                      <button
                        type="button"
                        className="shrink-0 text-slate-300 hover:text-slate-600"
                        aria-label="삭제"
                        onClick={() => removeHospital(row.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
