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
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-y-contain pb-10 [scrollbar-gutter:stable]">
      {/* 상단 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight text-slate-900">
            영업이익 · 수금현황
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatPeriodLabel(reportingMonth)} · 부가세 포함 · 수정 즉시 반영
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm ring-1 ring-slate-200/80">
            {saveState === "saving" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                저장 중
              </>
            )}
            {saveState === "saved" && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                저장됨
              </>
            )}
            {saveState === "idle" && "대기"}
            {saveState === "error" && (
              <span className="text-red-600">{error ?? "저장 실패"}</span>
            )}
          </span>
          <ReportingMonthNav showQuickMonths={false} />
        </div>
      </div>

      {/* 요약 KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="청구 합계"
          value={summary.billedTotal}
          hint={`활성 ${summary.hospitalCount}곳${
            summary.holdCount ? ` · 보류 ${summary.holdCount}` : ""
          }${
            summary.terminatedCount ? ` · 해지 ${summary.terminatedCount}` : ""
          }`}
        />
        <SummaryCard
          label="수금 완료"
          value={summary.receivedTotal}
          hint={`입금완료 ${summary.paidCount}곳`}
          tone="positive"
        />
        <SummaryCard
          label="미수"
          value={summary.unpaidTotal}
          hint={`미수 ${summary.unpaidCount}곳`}
          tone="warn"
        />
        <SummaryCard
          label="비용 합계"
          value={summary.expenseTotal}
          hint={`${month.expenses.length}건`}
        />
        <SummaryCard
          label="영업이익"
          value={summary.operatingProfit}
          hint="수금 − 비용"
          tone={summary.operatingProfit >= 0 ? "positive" : "danger"}
          emphasize
        />
      </div>

      {/* 초 / 10일 / 말일 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">
          기준일 현금 흐름
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {checkpoints.map((cp) => (
            <div
              key={cp.key}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
            >
              <p className="text-sm font-semibold text-slate-800">{cp.label}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">수금</dt>
                  <dd className="tabular-nums text-slate-800">
                    {formatCurrency(cp.received)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">비용</dt>
                  <dd className="tabular-nums text-slate-800">
                    {formatCurrency(cp.expenses)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-200/80 pt-2 font-semibold">
                  <dt className="text-slate-700">+/−</dt>
                  <dd
                    className={cn(
                      "tabular-nums",
                      cp.net >= 0 ? "text-emerald-700" : "text-red-600"
                    )}
                  >
                    {formatCurrency(cp.net)}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      {/* 월 비용 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            월 비용
            <span className="ml-2 font-normal text-slate-500">
              {formatCurrency(summary.expenseTotal)}
            </span>
          </h2>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full border-slate-200 text-xs"
              onClick={syncPayrollExpenses}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              급여반영
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full border-slate-200 text-xs"
              onClick={addExpense}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              추가
            </Button>
          </div>
        </div>
        {month.expenses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
            비용이 비어 있습니다. 「급여반영」을 눌러 주세요.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
                  <th className="px-3 py-2.5 font-medium">항목</th>
                  <th className="px-3 py-2.5 text-right font-medium">금액</th>
                  <th className="w-24 px-3 py-2.5 font-medium">지출일</th>
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {month.expenses.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-2 py-1.5">
                      <Input
                        value={row.name}
                        onChange={(e) =>
                          updateExpense(row.id, { name: e.target.value })
                        }
                        className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <MoneyInput
                        value={row.amount}
                        onChange={(n) => updateExpense(row.id, { amount: n })}
                        className="ml-auto h-8 w-[8.5rem] border-slate-200 bg-white"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {row.source === "meta-daily" ? (
                        <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                          매일
                        </span>
                      ) : (
                        <select
                          className="h-8 w-full rounded-full border border-slate-200 bg-white px-2 text-xs text-slate-700"
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
                          <option value={1}>1일</option>
                          <option value={10}>10일</option>
                          <option value={20}>20일</option>
                          <option value={25}>25일</option>
                          <option value={31}>말일</option>
                          {[5, 15].map((d) => (
                            <option key={d} value={d}>
                              {d}일
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-1 py-1.5">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="h-8 w-8 text-slate-400 hover:text-slate-700"
                        aria-label="삭제"
                        onClick={() => removeExpense(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 병원 수금 */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            병원 수금
            <span className="ml-2 font-normal text-slate-500">
              청구 {formatCurrency(summary.billedTotal)}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
              미수
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
              입금완료
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full border-slate-200 text-xs"
              onClick={addHospital}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              추가
            </Button>
          </div>
        </div>
        {month.hospitals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-400">
            병원이 없습니다.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs text-slate-500">
                  <th className="px-3 py-2.5 font-medium">병원</th>
                  <th className="w-20 px-2 py-2.5 font-medium">계약</th>
                  <th className="px-2 py-2.5 text-right font-medium">금액</th>
                  <th className="w-20 px-2 py-2.5 font-medium">예정일</th>
                  <th className="w-24 px-2 py-2.5 font-medium">상태</th>
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {month.hospitals.map((row) => {
                  const inactive =
                    row.contractStatus === "보류" ||
                    row.contractStatus === "해지";
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-slate-50 last:border-0 hover:bg-slate-50/60",
                        inactive && "opacity-55"
                      )}
                    >
                      <td className="px-2 py-1.5">
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            renameHospitalMaster(row.id, e.target.value)
                          }
                          className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="h-8 w-full rounded-full border border-slate-200 bg-white px-2 text-[11px]"
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
                      </td>
                      <td className="px-2 py-1.5">
                        <MoneyInput
                          value={row.amount}
                          onChange={(n) => {
                            updateHospital(row.id, { amount: n });
                            setHospitalDefaultAmount(row.id, n);
                          }}
                          className="ml-auto h-8 w-[7.5rem] border-slate-200 bg-white"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="h-8 w-full rounded-full border border-slate-200 bg-white px-2 text-xs"
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
                                {d}일
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          className={cn(
                            "inline-flex h-8 w-full items-center justify-center rounded-full text-xs font-medium ring-1 transition-colors",
                            row.status === "paid"
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                              : "bg-amber-50 text-amber-900 ring-amber-200"
                          )}
                          onClick={() =>
                            updateHospital(row.id, {
                              status: row.status === "paid" ? "unpaid" : "paid",
                            })
                          }
                        >
                          {row.status === "paid" ? "입금완료" : "미수"}
                        </button>
                      </td>
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="h-8 w-8 text-slate-400 hover:text-slate-700"
                          aria-label="삭제"
                          onClick={() => removeHospital(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
        "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm",
        emphasize && "ring-2 ring-indigo-900/10"
      )}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-lg font-semibold tabular-nums tracking-tight text-slate-900",
          tone === "positive" && "text-emerald-700",
          tone === "warn" && "text-amber-700",
          tone === "danger" && "text-red-600"
        )}
      >
        {formatCurrency(value)}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
