"use client";

import { cn } from "@/lib/utils";
import type { MonthOverMonth } from "@/lib/types";

interface MomBadgeProps {
  mom: MonthOverMonth | null;
  /** 비용 증가는 나쁜 방향일 때 invert */
  invertColors?: boolean;
}

export function MomBadge({ mom, invertColors = false }: MomBadgeProps) {
  if (!mom) {
    return (
      <span className="block text-xs leading-5 text-slate-400">
        전월 비교 없음
      </span>
    );
  }

  if (mom.changePercent === null) {
    return (
      <span className="block text-xs leading-5 text-slate-400">전월 0원</span>
    );
  }

  const up = mom.changePercent > 0;
  const down = mom.changePercent < 0;
  const flat = mom.changePercent === 0;

  const good = invertColors ? down : up;
  const bad = invertColors ? up : down;

  return (
    <span className="block leading-5">
      <span
        className={cn(
          "inline-flex w-fit max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
          flat && "bg-slate-100 text-slate-600",
          good && !flat && "bg-emerald-50 text-emerald-700",
          bad && !flat && "bg-rose-50 text-rose-600"
        )}
      >
        {up && "▲ "}
        {down && "▼ "}
        {flat && "— "}
        {mom.changePercent > 0 ? "+" : ""}
        {mom.changePercent.toFixed(1)}% 전월
      </span>
    </span>
  );
}
