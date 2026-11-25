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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain pb-4 [scrollbar-gutter:stable]">
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h1 className="text-base font-semibold tracking-tight text-slate-900">
            영업이익 · 수금현황
          </h1>
          <p className="text-xs text-slate-500">
            {formatPeriodLabel(reportingMonth)} · 부가세 포함
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            {saveState === "saving" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                저장 중
              </>
            )}
            {saveState === "saved" && (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                저장됨
              </>
            )}
            {saveState === "error" && (
              <span className="text-red-600">{error ?? "저장 실패"}</span>
            )}
          </span>
          <ReportingMonthNav showQuickMonths={false} />
        </div>
      </div>

      {/* 요약 KPI — 한 줄 밀도 */}
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-5">
        <SummaryCard
          label="청구"
          value={summary.billedTotal}
          hint={`${summary.hospitalCount}곳`}
        />
        <SummaryCard
          label="수금"
          value={summary.receivedTotal}
          hint={`${summary.paidCount}곳`}
          tone="positive"
        />
        <SummaryCard
          label="미수"
          value={summary.unpaidTotal}
          hint={`${summary.unpaidCount}곳`}
          tone="warn"
        />
        <SummaryCard
          label="비용"
          value={summary.expenseTotal}
          hint={`${month.expenses.length}건`}
        />
        <SummaryCard
          label="영업이익"
          value={summary.operatingProfit}
          tone={summary.operatingProfit >= 0 ? "positive" : "danger"}
          emphasize
        />
      </div>

      {/* 초 / 10일 / 말일 — 얇은 3열 */}
      <section className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
        <div className="grid gap-1.5 md:grid-cols-3">
          {checkpoints.map((cp) => (
            <div
              key={cp.key}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs"
            >
              <span className="font-semibold text-slate-700">{cp.label}</span>
              <span className="tabular-nums text-slate-600">
                수금 {formatCurrency(cp.received)}
              </span>
              <span className="tabular-nums text-slate-600">
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
      </section>

      {/* 월 비용 — 체크용 밀집 그리드 */}
      <section className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
          <h2 className="text-xs font-semibold text-slate-800">
            월 비용
            <span className="ml-1.5 font-normal text-slate-500">
              {formatCurrency(summary.expenseTotal)}
            </span>
          </h2>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 border-slate-200 px-2 text-[11px]"
              onClick={syncPayrollExpenses}
            >
              <RefreshCw className="mr-0.5 h-3 w-3" />
              급여반영
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 border-slate-200 px-2 text-[11px]"
              onClick={addExpense}
            >
              <Plus className="mr-0.5 h-3 w-3" />
              추가
            </Button>
          </div>
        </div>
        {month.expenses.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-400">
            비용 없음 · 급여반영을 눌러 주세요
          </p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
            {month.expenses.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-1 rounded border border-slate-100 bg-slate-50/50 px-1.5 py-0.5"
              >
                <Input
                  value={row.name}
                  onChange={(e) =>
                    updateExpense(row.id, { name: e.target.value })
                  }
                  className="h-6 min-w-0 flex-1 border-0 bg-transparent px-0.5 text-xs shadow-none focus-visible:ring-1"
                />
                <MoneyInput
                  value={row.amount}
                  onChange={(n) => updateExpense(row.id, { amount: n })}
                  className="h-6 w-[6.5rem] shrink-0 border-slate-200 bg-white px-1 text-xs"
                />
                {row.source === "meta-daily" ? (
                  <span className="w-9 shrink-0 text-center text-[10px] text-sky-700">
                    매일
                  </span>
                ) : (
                  <select
                    className="h-6 w-12 shrink-0 rounded border border-slate-200 bg-white px-0.5 text-[10px]"
                    value={row.payDay ?? ""}
                    aria-label="지출일"
                    onChange={(e) => {
                      const v = e.target.value;
                      updateExpensePayDay(row.id, v === "" ? null : Number(v));
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
                  className="shrink-0 p-0.5 text-slate-400 hover:text-slate-700"
                  aria-label="삭제"
                  onClick={() => removeExpense(row.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 병원 수금 — 체크용 밀집 그리드 */}
      <section className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
          <h2 className="text-xs font-semibold text-slate-800">
            병원 수금
            <span className="ml-1.5 font-normal text-slate-500">
              {formatCurrency(summary.billedTotal)}
            </span>
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 border-slate-200 px-2 text-[11px]"
            onClick={addHospital}
          >
            <Plus className="mr-0.5 h-3 w-3" />
            추가
          </Button>
        </div>
        {month.hospitals.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-400">병원 없음</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
            {month.hospitals.map((row) => {
              const inactive =
                row.contractStatus === "보류" || row.contractStatus === "해지";
              return (
                <div
                  key={row.id}
                  className={cn(
                    "flex items-center gap-1 rounded border px-1.5 py-0.5",
                    inactive
                      ? "border-slate-100 bg-slate-50 opacity-50"
                      : row.status === "paid"
                        ? "border-emerald-100 bg-emerald-50/40"
                        : "border-amber-100 bg-amber-50/30"
                  )}
                >
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      renameHospitalMaster(row.id, e.target.value)
                    }
                    className="h-6 min-w-0 flex-1 border-0 bg-transparent px-0.5 text-xs shadow-none focus-visible:ring-1"
                  />
                  <select
                    className="h-6 w-10 shrink-0 rounded border border-slate-200 bg-white px-0.5 text-[10px]"
                    value={row.contractStatus}
                    aria-label="계약"
                    onChange={(e) =>
                      setContractStatus(
                        row.id,
                        e.target.value as ContractStatus
                      )
                    }
                  >
                    {CONTRACT_STATUS_OPTIONS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                  <MoneyInput
                    value={row.amount}
                    onChange={(n) => {
                      updateHospital(row.id, { amount: n });
                      setHospitalDefaultAmount(row.id, n);
                    }}
                    className="h-6 w-[5.75rem] shrink-0 border-slate-200 bg-white px-1 text-xs"
                  />
                  <select
                    className="h-6 w-10 shrink-0 rounded border border-slate-200 bg-white px-0.5 text-[10px]"
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
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={cn(
                      "h-6 shrink-0 rounded px-1.5 text-[10px] font-semibold",
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
                  <button
                    type="button"
                    className="shrink-0 p-0.5 text-slate-400 hover:text-slate-700"
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
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
  emphasize,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "positive" | "warn" | "danger";
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5",
        emphasize && "border-slate-300"
      )}
    >
      <div className="flex items-baseline justify-between gap-1">
        <p className="text-[11px] text-slate-500">
          {label}
          {hint ? (
            <span className="ml-1 text-slate-400">· {hint}</span>
          ) : null}
        </p>
      </div>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums tracking-tight text-slate-900",
          tone === "positive" && "text-emerald-700",
          tone === "warn" && "text-amber-700",
          tone === "danger" && "text-red-600"
        )}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}
