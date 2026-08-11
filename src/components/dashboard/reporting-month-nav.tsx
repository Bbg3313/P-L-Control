"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinancial } from "@/contexts/financial-context";
import {
  formatPeriodLabel,
  getReportingMonthOptions,
  REPORTING_MONTH_MIN,
  shiftYearMonth,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface ReportingMonthNavProps {
  className?: string;
  showQuickMonths?: boolean;
  /** 사이드바 등 좁은 영역 */
  compact?: boolean;
}

export function ReportingMonthNav({
  className,
  showQuickMonths = true,
  compact = false,
}: ReportingMonthNavProps) {
  const { records, reportingMonth, setReportingMonth, hydrated } =
    useFinancial();

  const monthOptions = useMemo(
    () => getReportingMonthOptions(records, reportingMonth),
    [records, reportingMonth]
  );

  const canGoPrev = reportingMonth > REPORTING_MONTH_MIN;

  if (!hydrated) return null;

  return (
    <div className={cn("w-full min-w-0 space-y-3", className)}>
      <div
        className={cn(
          "w-full items-center gap-1",
          compact
            ? "grid grid-cols-[2rem_minmax(0,1fr)_2rem]"
            : "flex"
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn("shrink-0", compact && "h-8 w-8")}
          aria-label="이전 달"
          disabled={!canGoPrev}
          onClick={() =>
            setReportingMonth(shiftYearMonth(reportingMonth, -1))
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div
          className={cn(
            "min-w-0 text-center",
            !compact && "min-w-[8.5rem] flex-1 sm:min-w-[10rem]"
          )}
        >
          <p
            className={cn(
              "truncate font-semibold text-slate-900",
              compact ? "text-xs leading-tight" : "text-sm"
            )}
          >
            {formatPeriodLabel(reportingMonth)}
          </p>
          <p className="truncate text-[11px] text-slate-500">집계 기준 월</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn("shrink-0", compact && "h-8 w-8")}
          aria-label="다음 달"
          onClick={() =>
            setReportingMonth(shiftYearMonth(reportingMonth, 1))
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {showQuickMonths && monthOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {monthOptions.map((ym) => {
            const active = ym === reportingMonth;
            return (
              <button
                key={ym}
                type="button"
                onClick={() => setReportingMonth(ym)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {formatPeriodLabel(ym)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
