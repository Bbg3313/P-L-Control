"use client";

import { useFinancial } from "@/contexts/financial-context";
import { formatPeriodLabel } from "@/lib/calculations";

export function ReportingPeriod() {
  const { reportingMonth, hydrated } = useFinancial();

  return (
    <p className="mt-0.5 text-sm font-medium">
      {hydrated ? formatPeriodLabel(reportingMonth) : "—"}
    </p>
  );
}
