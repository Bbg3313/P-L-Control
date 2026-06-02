"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PeriodTotalVariant = "revenue" | "expense";

const variantStyles: Record<
  PeriodTotalVariant,
  { card: string; title: string; amount: string; sub: string; badge: string }
> = {
  revenue: {
    card: "border-teal-300/70 bg-gradient-to-br from-teal-50 to-teal-50/40 shadow-sm ring-1 ring-teal-200/50",
    title: "text-teal-800",
    amount: "text-teal-950",
    sub: "text-teal-700/90",
    badge: "bg-teal-100 text-teal-800",
  },
  expense: {
    card: "border-rose-300/70 bg-gradient-to-br from-rose-50 to-rose-50/40 shadow-sm ring-1 ring-rose-200/50",
    title: "text-rose-800",
    amount: "text-rose-950",
    sub: "text-rose-700/90",
    badge: "bg-rose-100 text-rose-800",
  },
};

interface PeriodTotalCardProps {
  variant: PeriodTotalVariant;
  title: string;
  amount: ReactNode;
  footer?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

/** 집계월 합계 — 입력 카드와 구분되는 색상 */
export function PeriodTotalCard({
  variant,
  title,
  amount,
  footer,
  meta,
  className,
}: PeriodTotalCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card
      size="sm"
      className={cn(
        "box-border w-full max-w-full ring-0",
        styles.card,
        className
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-sm font-semibold", styles.title)}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0 sm:flex-row sm:items-baseline sm:gap-x-6">
        <div className="min-w-0">
          <div className={cn("text-2xl font-bold tabular-nums", styles.amount)}>
            {amount}
          </div>
          {footer && (
            <div className={cn("mt-1 text-xs", styles.sub)}>{footer}</div>
          )}
        </div>
        {meta &&
          (typeof meta === "string" ? (
            <div
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-sm font-medium",
                styles.badge
              )}
            >
              {meta}
            </div>
          ) : (
            <div className={cn("min-w-0 text-sm leading-relaxed", styles.sub)}>
              {meta}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

interface PeriodTotalBarProps {
  variant: PeriodTotalVariant;
  children: ReactNode;
  className?: string;
}

/** 목록 하단 편집 합계 */
export function PeriodTotalBar({
  variant,
  children,
  className,
}: PeriodTotalBarProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        styles.card,
        className
      )}
    >
      {children}
    </div>
  );
}

export function periodTotalTextClass(variant: PeriodTotalVariant): string {
  return variantStyles[variant].sub;
}

export function periodTotalAmountClass(variant: PeriodTotalVariant): string {
  return cn("font-semibold tabular-nums", variantStyles[variant].amount);
}
