"use client";

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/dashboard/currency-display";
import { MomBadge } from "@/components/dashboard/mom-badge";
import { ENTITY_PURCHASE_LABEL, ENTITY_REVENUE_LABEL } from "@/lib/brand";
import { formatCurrency } from "@/lib/format";
import type { DashboardInsights } from "@/lib/types";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  PiggyBank,
  Receipt,
  FileInput,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  insights: DashboardInsights;
}

const cardShell =
  "flex h-full flex-col border-slate-200/80 bg-white shadow-sm ring-0 transition-shadow hover:shadow-md";

const cardHeaderClass = "shrink-0 pb-1";
const cardHeaderInnerClass = "min-h-[3.75rem]";
const cardContentClass = "flex flex-1 flex-col pt-0";
const amountRowClass = "flex min-h-9 items-end";
const footerRowClass = "mt-2 min-h-5";

function SummaryCardAmount({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(amountRowClass, className)}>{children}</div>;
}

function SummaryCardFooter({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(footerRowClass, className)}>
      {children ?? <span className="block" aria-hidden />}
    </div>
  );
}

export function SummaryCards({ insights }: SummaryCardsProps) {
  const { metrics, revenueMom, expensesMom, netProfitMom } = insights;
  const capacityShortfall = metrics.investmentCapacity < 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      <Card size="sm" className={cardShell}>
        <CardHeader className={cardHeaderClass}>
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              cardHeaderInnerClass
            )}
          >
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                총 매출
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {ENTITY_REVENUE_LABEL} · {metrics.periodLabel}
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
              <TrendingUp className="h-4 w-4 text-teal-600" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className={cardContentClass}>
          <SummaryCardAmount>
            <CurrencyDisplay
              amount={metrics.totalRevenue}
              valueClassName="text-2xl font-semibold text-slate-900"
            />
          </SummaryCardAmount>
          <SummaryCardFooter>
            <MomBadge mom={revenueMom} />
          </SummaryCardFooter>
        </CardContent>
      </Card>

      <Card size="sm" className={cardShell}>
        <CardHeader className={cardHeaderClass}>
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              cardHeaderInnerClass
            )}
          >
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                매출세액
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {ENTITY_REVENUE_LABEL} 계산서 · {metrics.periodLabel}
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
              <Receipt className="h-4 w-4 text-sky-600" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className={cardContentClass}>
          <SummaryCardAmount>
            <CurrencyDisplay
              amount={metrics.totalRevenueVat}
              valueClassName="text-2xl font-semibold text-slate-900"
            />
          </SummaryCardAmount>
          <SummaryCardFooter>
            {metrics.totalRevenueVatIncludedCount > 0 ? (
              <p className="block text-xs leading-5 text-slate-500">
                계산서 {metrics.totalRevenueVatIncludedCount}건 · 합계{" "}
                {formatCurrency(metrics.totalRevenueGross)}
              </p>
            ) : (
              <p className="block text-xs leading-5 text-slate-500">
                계산서 발행 매출 없음
              </p>
            )}
          </SummaryCardFooter>
        </CardContent>
      </Card>

      <Card size="sm" className={cardShell}>
        <CardHeader className={cardHeaderClass}>
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              cardHeaderInnerClass
            )}
          >
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                총 비용
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                인건비 + 기타
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
              <TrendingDown className="h-4 w-4 text-rose-500" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className={cardContentClass}>
          <SummaryCardAmount>
            <CurrencyDisplay
              amount={metrics.totalExpenses}
              valueClassName="text-2xl font-semibold text-slate-900"
            />
          </SummaryCardAmount>
          <SummaryCardFooter>
            <MomBadge mom={expensesMom} invertColors />
          </SummaryCardFooter>
        </CardContent>
      </Card>

      <Card size="sm" className={cardShell}>
        <CardHeader className={cardHeaderClass}>
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              cardHeaderInnerClass
            )}
          >
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                매입세액
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {ENTITY_PURCHASE_LABEL} 계산서 · {metrics.periodLabel}
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
              <FileInput className="h-4 w-4 text-indigo-600" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className={cardContentClass}>
          <SummaryCardAmount>
            <CurrencyDisplay
              amount={metrics.totalExpenseVat}
              valueClassName="text-2xl font-semibold text-slate-900"
            />
          </SummaryCardAmount>
          <SummaryCardFooter>
            {metrics.totalExpenseVatIncludedCount > 0 ? (
              <p className="block text-xs leading-5 text-slate-500">
                계산서 {metrics.totalExpenseVatIncludedCount}건
              </p>
            ) : (
              <p className="block text-xs leading-5 text-slate-500">
                계산서 수취 매입 없음
              </p>
            )}
          </SummaryCardFooter>
        </CardContent>
      </Card>

      <Card size="sm" className={cardShell}>
        <CardHeader className={cardHeaderClass}>
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              cardHeaderInnerClass
            )}
          >
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                순이익
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                매출 − 비용
              </CardDescription>
            </div>
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                metrics.netProfit >= 0
                  ? "bg-emerald-500/10"
                  : "bg-rose-500/10"
              )}
            >
              <CircleDollarSign
                className={cn(
                  "h-4 w-4",
                  metrics.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                )}
                strokeWidth={2}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className={cardContentClass}>
          <SummaryCardAmount>
            <CurrencyDisplay
              amount={metrics.netProfit}
              valueClassName={cn(
                "text-2xl font-semibold",
                metrics.netProfit >= 0 ? "text-emerald-600" : "text-rose-500"
              )}
            />
          </SummaryCardAmount>
          <SummaryCardFooter>
            <MomBadge mom={netProfitMom} />
          </SummaryCardFooter>
        </CardContent>
      </Card>

      <Card size="sm" className={cardShell}>
        <CardHeader className={cardHeaderClass}>
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              cardHeaderInnerClass
            )}
          >
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                환급세액
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                매입세 − 매출세 · {metrics.periodLabel}
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
              <RotateCcw className="h-4 w-4 text-cyan-600" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className={cardContentClass}>
          <SummaryCardAmount>
            <CurrencyDisplay
              amount={metrics.vatRefund}
              valueClassName="text-2xl font-semibold text-slate-900"
            />
          </SummaryCardAmount>
          <SummaryCardFooter>
            <p className="block text-xs leading-5 text-slate-500">
              매출세 {formatCurrency(metrics.totalRevenueVat)} · 매입세{" "}
              {formatCurrency(metrics.totalExpenseVat)}
              {metrics.vatPayable > 0 && (
                <>
                  {" "}
                  · 납부 {formatCurrency(metrics.vatPayable)}
                </>
              )}
            </p>
          </SummaryCardFooter>
        </CardContent>
      </Card>

      <Card
        size="sm"
        className={cn(
          cardShell,
          capacityShortfall && "border-amber-200/90 bg-amber-50/40"
        )}
      >
        <CardHeader className={cardHeaderClass}>
          <div
            className={cn(
              "flex items-start justify-between gap-3",
              cardHeaderInnerClass
            )}
          >
            <div className="space-y-1">
              <CardTitle
                className={cn(
                  "text-sm font-medium",
                  capacityShortfall ? "text-amber-900" : "text-slate-700"
                )}
              >
                투자 여력
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                순이익 − 운영비 {metrics.operatingReserveMonths}개월분
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
              <PiggyBank className="h-4 w-4 text-violet-600" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className={cardContentClass}>
          <SummaryCardAmount>
            {capacityShortfall ? (
              <p className="text-2xl font-semibold leading-none text-amber-800">
                예비금 부족
              </p>
            ) : (
              <CurrencyDisplay
                amount={metrics.investmentCapacity}
                valueClassName="text-2xl font-semibold text-emerald-600"
              />
            )}
          </SummaryCardAmount>
          <SummaryCardFooter />
        </CardContent>
      </Card>
    </div>
  );
}
