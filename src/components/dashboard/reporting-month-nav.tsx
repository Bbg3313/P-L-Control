"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinancial } from "@/contexts/financial-context";
import {
  formatPeriodLabel,
  getReportingMonthOptions,
  shiftYearMonth,
} from "@/lib/calculations";
import { cn } from "@/lib/utils";

interface ReportingMonthNavProps {
  className?: string;
  showQuickMonths?: boolean;
}

export function ReportingMonthNav({
  className,
  showQuickMonths = true,
}: ReportingMonthNavProps) {
  const { records, reportingMonth, setReportingMonth, hydrated } =
    useFinancial();

  const monthOptions = useMemo(
    () => getReportingMonthOptions(records, reportingMonth),
    [records, reportingMonth]
  );

  if (!hydrated) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="이전 달"
          onClick={() =>
            setReportingMonth(shiftYearMonth(reportingMonth, -1))
          }
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-[8.5rem] flex-1 text-center sm:min-w-[10rem]">
          <p className="text-sm font-semibold text-slate-900">
            {formatPeriodLabel(reportingMonth)}
          </p>
          <p className="text-[11px] text-slate-500">집계 기준 월</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
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
