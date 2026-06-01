import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/dashboard/currency-display";
import { formatCurrency } from "@/lib/format";
import type { DashboardMetrics } from "@/lib/types";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  PiggyBank,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  metrics: DashboardMetrics;
}

const cardShell =
  "border-slate-200/80 bg-white shadow-sm ring-0 transition-shadow hover:shadow-md";

export function SummaryCards({ metrics }: SummaryCardsProps) {
  const capacityShortfall = metrics.investmentCapacity < 0;
  const shortfallAmount = Math.abs(metrics.investmentCapacity);

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {/* 총 매출 */}
      <Card size="sm" className={cardShell}>
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                총 매출
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                해당 기간 전체 수입
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
              <TrendingUp className="h-4 w-4 text-teal-600" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <CurrencyDisplay
            amount={metrics.totalRevenue}
            valueClassName="text-3xl font-semibold text-slate-900"
          />
        </CardContent>
      </Card>

      {/* 총 비용 */}
      <Card size="sm" className={cardShell}>
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-medium text-slate-700">
                총 비용
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                해당 기간 운영 비용
              </CardDescription>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
              <TrendingDown className="h-4 w-4 text-rose-500" strokeWidth={2} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <CurrencyDisplay
            amount={metrics.totalExpenses}
            valueClassName="text-3xl font-semibold text-slate-900"
          />
        </CardContent>
      </Card>

      {/* 순이익 */}
      <Card size="sm" className={cardShell}>
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-3">
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
        <CardContent className="pt-2">
          <CurrencyDisplay
            amount={metrics.netProfit}
            valueClassName={cn(
              "text-3xl font-semibold",
              metrics.netProfit >= 0 ? "text-emerald-600" : "text-rose-500"
            )}
          />
        </CardContent>
      </Card>

      {/* 투자 여력 */}
      <Card
        size="sm"
        className={cn(
          cardShell,
          capacityShortfall &&
            "border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-rose-50/40"
        )}
      >
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle
                className={cn(
                  "text-sm font-medium",
                  capacityShortfall ? "text-amber-900" : "text-slate-700"
                )}
              >
                투자 여력
              </CardTitle>
              <CardDescription
                className={cn(
                  "text-xs",
                  capacityShortfall ? "text-amber-800/70" : "text-slate-500"
                )}
              >
                순이익 − 고정비 예비금
              </CardDescription>
            </div>
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                capacityShortfall
                  ? "bg-amber-500/15"
                  : "bg-violet-500/10"
              )}
            >
              {capacityShortfall ? (
                <AlertTriangle
                  className="h-4 w-4 text-amber-600"
                  strokeWidth={2}
                />
              ) : (
                <PiggyBank
                  className="h-4 w-4 text-violet-600"
                  strokeWidth={2}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {capacityShortfall ? (
            <div className="space-y-2">
              <p className="text-lg font-semibold tracking-tight text-amber-900">
                예비금 부족
              </p>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800/60">
                Reserve Shortfall
              </p>
              <div className="rounded-lg border border-amber-200/80 bg-white/60 px-3 py-2">
                <p className="text-xs text-amber-900/70">부족 금액</p>
                <CurrencyDisplay
                  amount={shortfallAmount}
                  valueClassName="text-2xl font-semibold text-rose-500"
                  symbolClassName="text-rose-400"
                />
              </div>
            </div>
          ) : (
            <CurrencyDisplay
              amount={metrics.investmentCapacity}
              valueClassName="text-3xl font-semibold text-emerald-600"
            />
          )}
          <p
            className={cn(
              "mt-3 text-xs",
              capacityShortfall ? "text-amber-800/65" : "text-slate-500"
            )}
          >
            예비금 {formatCurrency(metrics.fixedCostsReserve)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
