"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildAnnualLeaveTimeline,
  buildLawReferenceSeries,
} from "@/lib/annual-leave-law";
import { cn } from "@/lib/utils";

interface LeaveEmployeeRow {
  id: string;
  name: string;
  department: string;
  position: string;
  status: string;
  acquiredDate: string;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
  phase: "monthly" | "annual" | null;
  tenureMonths: number;
  tenureYears: number;
  ruleLabel: string;
}

const CHART = {
  granted: "#6366f1",
  used: "#f43f5e",
  remaining: "#14b8a6",
  timeline: "#8b5cf6",
  law: "#3b82f6",
  grid: "#e2e8f0",
  axis: "#94a3b8",
};

function DaysTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm tabular-nums text-slate-800">
          <span className="font-medium">{entry.name}</span>: {entry.value}일
        </p>
      ))}
    </div>
  );
}

export function HrLeavePage() {
  const [employees, setEmployees] = useState<LeaveEmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hr-leave", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "연차 현황을 불러오지 못했습니다.");
      }
      const data = (await res.json()) as { employees: LeaveEmployeeRow[] };
      const list = data.employees ?? [];
      setEmployees(list);
      setSelectedId((prev) =>
        prev && list.some((e) => e.id === prev) ? prev : (list[0]?.id ?? null)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "연차 현황을 불러오지 못했습니다.");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => employees.find((e) => e.id === selectedId) ?? null,
    [employees, selectedId]
  );

  const overviewChart = useMemo(
    () =>
      employees.map((e) => ({
        name: e.name,
        발생: e.grantedDays,
        사용: e.usedDays,
        잔여: e.remainingDays,
      })),
    [employees]
  );

  const timelineChart = useMemo(() => {
    if (!selected?.acquiredDate) return [];
    return buildAnnualLeaveTimeline(selected.acquiredDate, 36).map((p) => ({
      label: p.label,
      연차: p.days,
      phase: p.phase,
    }));
  }, [selected]);

  const lawChart = useMemo(() => buildLawReferenceSeries(), []);

  async function saveUsedDays(employeeId: string, usedDays: number) {
    setSavingId(employeeId);
    setError(null);
    try {
      const res = await fetch("/api/hr-leave", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, usedDays }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "저장하지 못했습니다.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <header className="sticky top-0 z-30 w-full shrink-0 border-b border-slate-200/80 bg-slate-50/95 pb-4 shadow-sm backdrop-blur-sm">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">연차현황</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            근로기준법 제60조 기준 연차 발생·사용·잔여를 그래프로 확인합니다.
          </p>
        </div>
      </header>

      <div className="w-full min-w-0 space-y-5 pb-6 pt-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">근로기준법 연차 발생 기준</CardTitle>
            <CardDescription>
              출근율 80% 이상 가정 · 1년 미만 월 1일(최대 11일) · 1년 이상 15일 ·
              3년부터 2년마다 1일 가산(최대 25일)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lawChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: CHART.axis, fontSize: 11 }} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: CHART.axis, fontSize: 11 }}
                    label={{ value: "일", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <Tooltip content={<DaysTooltip />} />
                  <Bar dataKey="days" name="법정 연차" fill={CHART.law} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            불러오는 중…
          </p>
        ) : employees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center">
              <CalendarDays className="h-10 w-10 text-violet-400/80" />
              <p className="mt-4 text-sm font-medium">재직·휴직 직원이 없습니다</p>
              <p className="mt-1 text-sm text-muted-foreground">
                인사기록부에 입사일을 등록하면 연차가 자동 계산됩니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">팀 연차 현황</CardTitle>
                <CardDescription>발생 · 사용 · 잔여 (일)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={overviewChart}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: CHART.axis, fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 11 }} />
                      <Tooltip content={<DaysTooltip />} />
                      <Legend />
                      <Bar dataKey="발생" fill={CHART.granted} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="사용" fill={CHART.used} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="잔여" fill={CHART.remaining} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">직원별 연차</CardTitle>
                  <CardDescription>사용 일수 입력 시 잔여가 갱신됩니다</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {employees.map((emp) => (
                    <div
                      key={emp.id}
                      className={cn(
                        "rounded-xl border p-3 transition-colors",
                        selectedId === emp.id
                          ? "border-violet-300 bg-violet-50/50"
                          : "border-slate-200 bg-white"
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setSelectedId(emp.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-900">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {[emp.position, emp.department].filter(Boolean).join(" · ") ||
                                "—"}
                            </p>
                          </div>
                          <div className="text-right text-sm tabular-nums">
                            <p className="font-semibold text-violet-700">
                              잔여 {emp.remainingDays}일
                            </p>
                            <p className="text-xs text-slate-500">
                              발생 {emp.grantedDays} · 사용 {emp.usedDays}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{emp.ruleLabel}</p>
                      </button>
                      <div className="mt-3 flex items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor={`used-${emp.id}`} className="text-xs">
                            사용 연차
                          </Label>
                          <Input
                            id={`used-${emp.id}`}
                            type="number"
                            min={0}
                            max={emp.grantedDays}
                            className="h-8 tabular-nums"
                            defaultValue={emp.usedDays}
                            key={`${emp.id}-${emp.usedDays}`}
                            onBlur={(e) => {
                              const next = Number.parseInt(e.target.value, 10);
                              if (
                                Number.isFinite(next) &&
                                next >= 0 &&
                                next !== emp.usedDays
                              ) {
                                void saveUsedDays(emp.id, next);
                              }
                            }}
                            disabled={savingId === emp.id}
                          />
                        </div>
                        {savingId === emp.id && (
                          <Loader2 className="mb-2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {selected ? `${selected.name} 연차 발생 추이` : "연차 발생 추이"}
                  </CardTitle>
                  <CardDescription>
                    입사 후 근속에 따른 법정 연차 변화 (개근 가정)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selected?.acquiredDate ? (
                    <div className="h-[320px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={timelineChart}
                          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: CHART.axis, fontSize: 10 }}
                            interval="preserveStartEnd"
                          />
                          <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 11 }} />
                          <Tooltip content={<DaysTooltip />} />
                          <ReferenceLine
                            y={15}
                            stroke={CHART.granted}
                            strokeDasharray="4 4"
                            label={{ value: "15일", position: "right", fontSize: 10 }}
                          />
                          <Line
                            type="stepAfter"
                            dataKey="연차"
                            name="발생 연차"
                            stroke={CHART.timeline}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      입사일이 있는 직원을 선택해 주세요.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
