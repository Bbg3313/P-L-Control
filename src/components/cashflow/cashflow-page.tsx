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
  deriveStatus,
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
} from "@/lib/cashflow-store";
import {
  COLLECTION_STATUS_LABELS,
  CONTRACT_STATUS_OPTIONS,
  createEmptyCashflow,
  newId,
  type CashflowMonth,
  type CashflowSnapshot,
  type CollectionStatus,
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

function payDayLabel(payDay: number | null): string {
  if (payDay == null) return "—";
  if (payDay >= 28) return "말일";
  return `${payDay}일`;
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

  // 보고월이 바뀌었는데 해당 월 데이터가 없으면 마스터에서 생성
  useEffect(() => {
    if (!hydrated) return;
    setSnapshot((prev) => {
      if (prev.months[reportingMonth]) return prev;
      const seeded = ensureMonth(prev, reportingMonth, perfOverrides);
      return {
        ...prev,
        months: { ...prev.months, [reportingMonth]: seeded },
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

  function updateHospital(
    id: string,
    patch: Partial<HospitalMonthRow>,
    autoStatus = true
  ) {
    const hospitals = month.hospitals.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, ...patch };
      if (autoStatus && ("amount" in patch || "receivedAmount" in patch)) {
        next.status = deriveStatus(next.amount, next.receivedAmount);
      }
      if (patch.status === "paid" && !next.paidDate && !patch.paidDate) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        // 보고월과 같은 달이면 오늘, 아니면 보고월 말일 근처
        if (`${y}-${m}` === reportingMonth) {
          next.paidDate = `${y}-${m}-${d}`;
        } else {
          next.paidDate = `${reportingMonth}-10`;
        }
      }
      if (patch.status === "unpaid") {
        next.receivedAmount = 0;
        next.paidDate = "";
      }
      if (patch.status === "paid" && next.receivedAmount <= 0) {
        next.receivedAmount = next.amount;
      }
      return next;
    });
    persistMonth({ ...month, hospitals });
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
            emptyHospitalRow(id, "새 병원", 0, "외주"),
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
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            영업이익 · 수금현황
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatPeriodLabel(reportingMonth)} · 금액은 모두 부가세 포함 · 수동
            수정 즉시 반영
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
            {saveState === "error" && (
              <span className="text-destructive">{error ?? "저장 실패"}</span>
            )}
          </span>
          <ReportingMonthNav showQuickMonths={false} />
        </div>
      </div>

      {/* 한눈에 보는 요약 */}
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
          hint={`완료 ${summary.paidCount} · 부분 ${summary.partialCount}`}
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
      <div className="grid gap-3 md:grid-cols-3">
        {checkpoints.map((cp) => (
          <div
            key={cp.key}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-sm font-medium">{cp.label}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">수금</dt>
                <dd className="tabular-nums">{formatCurrency(cp.received)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">비용</dt>
                <dd className="tabular-nums">{formatCurrency(cp.expenses)}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-border pt-1.5 font-semibold">
                <dt>+/−</dt>
                <dd
                  className={cn(
                    "tabular-nums",
                    cp.net >= 0 ? "text-emerald-700" : "text-destructive"
                  )}
                >
                  {formatCurrency(cp.net)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {/* 병원 수금 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">병원 수금</h2>
          <Button type="button" size="sm" variant="outline" onClick={addHospital}>
            <Plus className="mr-1 h-4 w-4" />
            병원 추가
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">병원</th>
                <th className="px-3 py-2 font-medium">계약</th>
                <th className="px-3 py-2 font-medium text-right">청구액</th>
                <th className="px-3 py-2 font-medium text-right">입금액</th>
                <th className="px-3 py-2 font-medium">수금</th>
                <th className="px-3 py-2 font-medium">입금일</th>
                <th className="px-3 py-2 font-medium">비고</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {month.hospitals.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    병원을 추가하거나 목록을 주시면 여기에 표시됩니다.
                  </td>
                </tr>
              )}
              {month.hospitals.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-t border-border",
                    (row.contractStatus === "보류" ||
                      row.contractStatus === "해지") &&
                      "bg-muted/30 opacity-80"
                  )}
                >
                  <td className="px-3 py-1.5">
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        renameHospitalMaster(row.id, e.target.value)
                      }
                      className="min-w-[9rem]"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className={cn(
                        "h-8 w-full min-w-[5.5rem] rounded-lg border border-input bg-transparent px-2 text-sm",
                        row.contractStatus === "보류" && "text-amber-700",
                        row.contractStatus === "해지" && "text-muted-foreground",
                        row.contractStatus === "외주" && "text-sky-700",
                        row.contractStatus === "자체" && "text-violet-700"
                      )}
                      value={row.contractStatus}
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
                  <td className="px-3 py-1.5">
                    <MoneyInput
                      value={row.amount}
                      onChange={(n) => {
                        updateHospital(row.id, { amount: n });
                        setHospitalDefaultAmount(row.id, n);
                      }}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <MoneyInput
                      value={row.receivedAmount}
                      onChange={(n) =>
                        updateHospital(row.id, { receivedAmount: n })
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <select
                      className={cn(
                        "h-8 w-full min-w-[6rem] rounded-lg border border-input bg-transparent px-2 text-sm",
                        row.status === "paid" && "text-emerald-700",
                        row.status === "unpaid" && "text-amber-700",
                        row.status === "partial" && "text-sky-700"
                      )}
                      value={row.status}
                      onChange={(e) =>
                        updateHospital(
                          row.id,
                          { status: e.target.value as CollectionStatus },
                          false
                        )
                      }
                    >
                      {(
                        Object.keys(
                          COLLECTION_STATUS_LABELS
                        ) as CollectionStatus[]
                      ).map((key) => (
                        <option key={key} value={key}>
                          {COLLECTION_STATUS_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      type="date"
                      value={row.paidDate}
                      onChange={(e) =>
                        updateHospital(
                          row.id,
                          { paidDate: e.target.value },
                          false
                        )
                      }
                      className="min-w-[9rem]"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={row.note}
                      onChange={(e) =>
                        updateHospital(row.id, { note: e.target.value }, false)
                      }
                      placeholder="메모"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="삭제"
                      onClick={() => removeHospital(row.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 비용 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">월 비용</h2>
            <p className="text-xs text-muted-foreground">
              Meta 일 70만(매일) · 인건비 BBG 10일 / 골드펜더·태국·베트남
              말일 · 임대·관리 1일 · 4대보험·대출 10일 · AI 25일 · 영업커미션
              직접입력
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={syncPayrollExpenses}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              급여 실지급 반영
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addExpense}
            >
              <Plus className="mr-1 h-4 w-4" />
              비용 추가
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">항목</th>
                <th className="px-3 py-2 font-medium text-right">금액</th>
                <th className="px-3 py-2 font-medium">지출일</th>
                <th className="px-3 py-2 font-medium">비고</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {month.expenses.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    비용을 추가해 주세요. (인건비, 광고비 등)
                  </td>
                </tr>
              )}
              {month.expenses.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        updateExpense(row.id, { name: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <MoneyInput
                      value={row.amount}
                      onChange={(n) => updateExpense(row.id, { amount: n })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    {row.source === "meta-daily" ? (
                      <p className="text-sm text-muted-foreground">매일</p>
                    ) : (
                      <select
                        className="h-8 w-full min-w-[5.5rem] rounded-lg border border-input bg-transparent px-2 text-sm"
                        value={row.payDay ?? ""}
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
                        <option value={25}>25일</option>
                        <option value={31}>말일</option>
                        {[5, 15, 20].map((d) => (
                          <option key={d} value={d}>
                            {d}일
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {row.source === "meta-daily"
                        ? `일 ${formatCurrency(row.dailyAmount ?? 700_000)}`
                        : payDayLabel(row.payDay)}
                    </p>
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={row.note}
                      onChange={(e) =>
                        updateExpense(row.id, { note: e.target.value })
                      }
                      placeholder="메모"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="삭제"
                      onClick={() => removeExpense(row.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        "rounded-xl border border-border bg-card p-4",
        emphasize && "ring-1 ring-foreground/10"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums tracking-tight",
          tone === "positive" && "text-emerald-700",
          tone === "warn" && "text-amber-700",
          tone === "danger" && "text-destructive"
        )}
      >
        {formatCurrency(value)}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
