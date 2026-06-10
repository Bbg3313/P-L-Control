"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  type HrLeaveEntry,
  type LeaveEntryType,
  leaveDaysForType,
} from "@/lib/hr-leave-types";
import { formatHrRecordDate } from "@/lib/hr-records-utils";
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
  entries: HrLeaveEntry[];
  phase: "monthly" | "annual" | null;
  tenureMonths: number;
  useByDate: string | null;
  ruleLabel: string;
}

function formatDays(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

/** 입사일 기준 근무일수(근속) 내림차순 — 입사일이 빠를수록 위 */
function sortEmployeesByTenureDesc(
  employees: LeaveEmployeeRow[]
): LeaveEmployeeRow[] {
  return [...employees].sort((a, b) => {
    const aDate = a.acquiredDate?.trim() ?? "";
    const bDate = b.acquiredDate?.trim() ?? "";
    if (!aDate && !bDate) return a.name.localeCompare(b.name, "ko");
    if (!aDate) return 1;
    if (!bDate) return -1;
    const byHireDate = aDate.localeCompare(bDate);
    if (byHireDate !== 0) return byHireDate;
    return a.name.localeCompare(b.name, "ko");
  });
}

function formatEntryTooltip(entry: HrLeaveEntry): string {
  return `${entry.date} · ${entry.type} (${formatDays(entry.days)}일)`;
}

interface LeaveHoverTip {
  lines: string[];
  x: number;
  y: number;
}

function createHoverTip(lines: string[], x: number, y: number): LeaveHoverTip {
  const uniqueLines = Array.from(new Set(lines));
  const tooltipWidth = 260;
  const tooltipHeight = uniqueLines.length * 20 + 12;
  let nextX = x + 12;
  let nextY = y + 16;

  if (typeof window !== "undefined") {
    if (nextX + tooltipWidth > window.innerWidth - 8) {
      nextX = window.innerWidth - tooltipWidth - 8;
    }
    if (nextY + tooltipHeight > window.innerHeight - 8) {
      nextY = y - tooltipHeight - 12;
    }
    nextX = Math.max(8, nextX);
    nextY = Math.max(8, nextY);
  }

  return { lines: uniqueLines, x: nextX, y: nextY };
}

function LeaveUsageTooltip({ tip }: { tip: LeaveHoverTip | null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !tip || tip.lines.length === 0) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[200] max-w-[16rem] rounded-md border border-slate-700/30 bg-slate-900 px-2.5 py-1.5 text-xs leading-relaxed text-white shadow-lg"
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      {tip.lines.map((line) => (
        <p key={line} className="whitespace-nowrap">
          {line}
        </p>
      ))}
    </div>,
    document.body
  );
}

interface LeaveCellPart {
  entry: HrLeaveEntry;
  leftPct: number;
  widthPct: number;
}

interface LeaveDayCell {
  isGranted: boolean;
  usedInCell: number;
  parts: LeaveCellPart[];
}

function buildLeaveDayCells(
  entries: HrLeaveEntry[],
  granted: number,
  used: number
): LeaveDayCell[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const placements: { entry: HrLeaveEntry; start: number; end: number }[] = [];
  let cursor = 0;
  for (const entry of sorted) {
    placements.push({ entry, start: cursor, end: cursor + entry.days });
    cursor += entry.days;
  }

  const totalCells = Math.max(Math.ceil(granted), Math.ceil(used), Math.ceil(cursor));
  return Array.from({ length: totalCells }, (_, index) => {
    const usedInCell = Math.min(1, Math.max(0, used - index));
    const parts: LeaveCellPart[] = [];

    if (usedInCell > 0) {
      for (const placement of placements) {
        const overlapStart = Math.max(index, placement.start);
        const overlapEnd = Math.min(index + usedInCell, placement.end);
        if (overlapEnd > overlapStart) {
          parts.push({
            entry: placement.entry,
            leftPct: ((overlapStart - index) / usedInCell) * 100,
            widthPct: ((overlapEnd - overlapStart) / usedInCell) * 100,
          });
        }
      }
    }

    return {
      isGranted: index < granted,
      usedInCell,
      parts,
    };
  });
}

function LeaveDayBlocks({
  granted,
  used,
  entries = [],
  size = "md",
  scrollable = false,
}: {
  granted: number;
  used: number;
  entries?: HrLeaveEntry[];
  size?: "md" | "sm";
  /** 팀 현황처럼 칸이 잘리지 않게 한 줄 + 가로 스크롤 */
  scrollable?: boolean;
}) {
  const [hoverTip, setHoverTip] = useState<LeaveHoverTip | null>(null);
  const cells = buildLeaveDayCells(entries, granted, used);

  function showTip(event: React.MouseEvent, parts: LeaveCellPart[]) {
    if (parts.length === 0) return;
    setHoverTip(
      createHoverTip(
        parts.map((part) => formatEntryTooltip(part.entry)),
        event.clientX,
        event.clientY
      )
    );
  }

  function moveTip(event: React.MouseEvent) {
    setHoverTip((prev) => (prev ? createHoverTip(prev.lines, event.clientX, event.clientY) : null));
  }

  if (cells.length <= 0) {
    return (
      <span className="text-xs text-muted-foreground">발생 연차 없음</span>
    );
  }

  const cellClass =
    size === "sm"
      ? "h-4 w-4 shrink-0 rounded-[3px]"
      : "h-5 w-5 shrink-0 rounded-[4px] sm:h-6 sm:w-6";

  return (
    <>
      <div
        className={cn(
          "flex gap-0.5",
          scrollable ? "w-max shrink-0 flex-nowrap" : "flex-wrap"
        )}
        role="img"
        aria-label={`발생 ${formatDays(granted)}일 중 ${formatDays(used)}일 사용`}
      >
        {cells.map((cell, index) => (
          <div
            key={index}
            className={cn(
              cellClass,
              "relative overflow-hidden border",
              cell.isGranted
                ? "border-teal-200/80 bg-teal-50"
                : "border-slate-200 bg-slate-100"
            )}
          >
            {cell.usedInCell > 0 && (
              <div
                className={cn(
                  "absolute inset-y-0 left-0 z-10 h-full",
                  cell.parts.length > 0 ? "cursor-help" : "cursor-default"
                )}
                style={{ width: `${cell.usedInCell * 100}%` }}
                onMouseEnter={(event) => showTip(event, cell.parts)}
                onMouseMove={moveTip}
                onMouseLeave={() => setHoverTip(null)}
              >
                {cell.parts.length > 0 ? (
                  cell.parts.map((part) => (
                    <div
                      key={`${part.entry.id}-${part.leftPct}`}
                      className="pointer-events-none absolute inset-y-0 bg-slate-400"
                      style={{
                        left: `${part.leftPct}%`,
                        width: `${part.widthPct}%`,
                      }}
                    />
                  ))
                ) : (
                  <div className="pointer-events-none h-full w-full bg-slate-400" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <LeaveUsageTooltip tip={hoverTip} />
    </>
  );
}

function TeamLeaveRow({ employee }: { employee: LeaveEmployeeRow }) {
  const isMonthly = employee.phase === "monthly";
  const showUseBy = Boolean(employee.useByDate);

  return (
    <div className="grid gap-3 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,7.5rem)] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">
          {employee.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[employee.position, employee.department].filter(Boolean).join(" · ") ||
            "—"}
        </p>
      </div>

      <div className="min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
        <LeaveDayBlocks
          granted={employee.grantedDays}
          used={employee.usedDays}
          entries={employee.entries}
          scrollable
        />
      </div>

      <div className="shrink-0 text-right text-xs tabular-nums text-slate-600 sm:text-sm">
        <p>
          <span className="font-medium text-slate-800">
            {formatDays(employee.usedDays)}
          </span>
          <span className="text-slate-400"> / </span>
          {formatDays(employee.grantedDays)}일
        </p>
        <p className="text-teal-700">잔여 {formatDays(employee.remainingDays)}일</p>
        {isMonthly && (
          <p className="mt-0.5 text-[11px] text-slate-500">
            월 1일 · 현재 {formatDays(employee.grantedDays)}일
          </p>
        )}
        {showUseBy && (
          <p className="mt-0.5 text-[11px] text-amber-700">
            소진 {formatHrRecordDate(employee.useByDate!)}까지
          </p>
        )}
      </div>
    </div>
  );
}

function LeaveEntryForm({
  employee,
  saving,
  onSave,
}: {
  employee: LeaveEmployeeRow;
  saving: boolean;
  onSave: (employeeId: string, entries: HrLeaveEntry[]) => Promise<void>;
}) {
  const [draftDate, setDraftDate] = useState("");
  const [draftType, setDraftType] = useState<LeaveEntryType>("연차");

  async function persistEntries(nextEntries: HrLeaveEntry[]) {
    await onSave(employee.id, nextEntries);
  }

  async function addEntry() {
    if (!draftDate) return;
    const entry: HrLeaveEntry = {
      id: crypto.randomUUID(),
      date: draftDate,
      type: draftType,
      days: leaveDaysForType(draftType),
    };
    const nextEntries = [...employee.entries, entry].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    await persistEntries(nextEntries);
    setDraftDate("");
  }

  async function removeEntry(entryId: string) {
    const nextEntries = employee.entries.filter((entry) => entry.id !== entryId);
    await persistEntries(nextEntries);
  }

  const overused = employee.usedDays > employee.grantedDays;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{employee.name}</p>
          <p className="text-xs text-muted-foreground">
            {[employee.position, employee.department].filter(Boolean).join(" · ") ||
              "—"}
          </p>
        </div>
        <div className="text-right text-sm tabular-nums">
          <p className="font-semibold text-teal-700">
            잔여 {formatDays(employee.remainingDays)}일
          </p>
          <p className="text-xs text-slate-500">
            발생 {formatDays(employee.grantedDays)} · 사용{" "}
            {formatDays(employee.usedDays)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <LeaveDayBlocks
          granted={employee.grantedDays}
          used={employee.usedDays}
          entries={employee.entries}
          size="sm"
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">{employee.ruleLabel}</p>
      {overused && (
        <p className="mt-1 text-xs text-amber-700" role="status">
          사용 일수가 발생 연차를 초과했습니다.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`date-${employee.id}`} className="text-xs">
            사용일
          </Label>
          <Input
            id={`date-${employee.id}`}
            type="date"
            className="h-8 w-[10.5rem]"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`type-${employee.id}`} className="text-xs">
            구분
          </Label>
          <select
            id={`type-${employee.id}`}
            className="flex h-8 w-[6.5rem] rounded-md border border-input bg-background px-2 text-sm shadow-sm"
            value={draftType}
            onChange={(e) => setDraftType(e.target.value as LeaveEntryType)}
            disabled={saving}
          >
            <option value="연차">연차 (1일)</option>
            <option value="반차">반차 (0.5일)</option>
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8"
          onClick={() => void addEntry()}
          disabled={!draftDate || saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="mr-1 h-3.5 w-3.5" />
              추가
            </>
          )}
        </Button>
      </div>

      {employee.entries.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {employee.entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm"
            >
              <span className="tabular-nums text-slate-700">
                {entry.date}{" "}
                <span className="text-slate-500">
                  {entry.type} {formatDays(entry.days)}일
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-slate-400 hover:text-destructive"
                onClick={() => void removeEntry(entry.id)}
                disabled={saving}
                aria-label="삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          등록된 연차 사용 내역이 없습니다.
        </p>
      )}
    </div>
  );
}

export function HrLeavePage() {
  const [employees, setEmployees] = useState<LeaveEmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setEmployees(data.employees ?? []);
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

  const teamEmployees = useMemo(
    () => sortEmployeesByTenureDesc(employees),
    [employees]
  );

  async function saveEntries(employeeId: string, entries: HrLeaveEntry[]) {
    setSavingId(employeeId);
    setError(null);
    try {
      const res = await fetch("/api/hr-leave", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, entries }),
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
            팀별 발생·사용을 일수 칸으로 확인하고, 날짜·연차/반차 단위로 사용
            내역을 등록합니다.
          </p>
        </div>
      </header>

      <div className="w-full min-w-0 space-y-5 pb-6 pt-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

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
            <Card className="overflow-visible">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">팀 연차 현황</CardTitle>
                <CardDescription>
                  입사일 기준 근속 오래된 순 · 1년 미만은 월별 발생, 모두 소진기한
                  표시
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-visible">
                <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded-[3px] border border-teal-200 bg-teal-50" />
                    잔여
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded-[3px] border border-teal-200 bg-slate-400" />
                    사용
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded-[3px] border border-slate-200 bg-slate-100" />
                    미발생
                  </span>
                </div>
                <div>
                  {teamEmployees.map((employee) => (
                    <TeamLeaveRow key={employee.id} employee={employee} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">직원별 연차 사용 등록</CardTitle>
                <CardDescription>
                  날짜와 연차·반차(0.5일) 단위로 사용 내역을 추가합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {employees.map((employee) => (
                  <LeaveEntryForm
                    key={employee.id}
                    employee={employee}
                    saving={savingId === employee.id}
                    onSave={saveEntries}
                  />
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
