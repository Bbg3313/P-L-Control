"use client";

import type { CheckpointSummary } from "@/lib/cashflow-calc";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CashflowGapOverviewProps {
  checkpoints: CheckpointSummary[];
  className?: string;
}

function GapBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "received" | "expense";
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-800">
          {formatCurrency(value)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            tone === "received" ? "bg-teal-500" : "bg-rose-400"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CashflowGapOverview({
  checkpoints,
  className,
}: CashflowGapOverviewProps) {
  const monthEnd =
    checkpoints.find((c) => c.key === "monthEnd") ?? checkpoints.at(-1);
  if (!monthEnd) return null;

  const short = monthEnd.net < 0;
  const gap = Math.abs(monthEnd.net);
  const coverMax = Math.max(monthEnd.received, monthEnd.expenses, 1);
  const coverPct =
    monthEnd.expenses > 0
      ? Math.min(100, Math.round((monthEnd.received / monthEnd.expenses) * 100))
      : monthEnd.received > 0
        ? 100
        : 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white px-3 py-2.5",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
        {/* 한눈: 말일 부족/여유 */}
        <div
          className={cn(
            "flex min-w-[11rem] shrink-0 flex-col justify-center rounded-md px-3 py-2",
            short ? "bg-red-50" : "bg-emerald-50"
          )}
        >
          <div
            className={cn(
              "text-[11px] font-semibold",
              short ? "text-red-700" : "text-emerald-800"
            )}
          >
            말일 기준 · 비용 대비
          </div>
          <div
            className={cn(
              "mt-0.5 text-2xl font-bold tabular-nums tracking-tight",
              short ? "text-red-600" : "text-emerald-700"
            )}
          >
            {formatCurrency(gap)}
          </div>
          <div
            className={cn(
              "text-sm font-semibold",
              short ? "text-red-600" : "text-emerald-700"
            )}
          >
            {short ? "더 필요" : "남음"}
            <span className="ml-1.5 text-xs font-medium opacity-80">
              수금 커버 {coverPct}%
            </span>
          </div>
        </div>

        {/* 수금 vs 비용 막대 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <GapBar
            label="예정수금 (입금+예정)"
            value={monthEnd.received}
            max={coverMax}
            tone="received"
          />
          <GapBar
            label="월 비용"
            value={monthEnd.expenses}
            max={coverMax}
            tone="expense"
          />
          <div className="flex flex-wrap gap-x-3 text-[11px] text-slate-500">
            <span>
              입금{" "}
              <span className="tabular-nums text-slate-700">
                {formatCurrency(monthEnd.paidReceived)}
              </span>
            </span>
            <span>
              예정{" "}
              <span className="tabular-nums text-slate-700">
                {formatCurrency(monthEnd.unpaidReceived)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 시점별 갭만 */}
      <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2.5">
        {checkpoints.map((cp) => {
          const cpShort = cp.net < 0;
          return (
            <div
              key={cp.key}
              className={cn(
                "rounded-md px-2 py-1.5 text-center",
                cpShort ? "bg-red-50/80" : "bg-emerald-50/80"
              )}
            >
              <div className="text-[10px] font-medium text-slate-500">
                {cp.label.replace(" 기준", "")}
              </div>
              <div
                className={cn(
                  "mt-0.5 text-sm font-bold tabular-nums tracking-tight",
                  cpShort ? "text-red-600" : "text-emerald-700"
                )}
              >
                {formatCurrency(Math.abs(cp.net))}
              </div>
              <div
                className={cn(
                  "text-[10px] font-semibold",
                  cpShort ? "text-red-600" : "text-emerald-700"
                )}
              >
                {cpShort ? "더 필요" : "남음"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
