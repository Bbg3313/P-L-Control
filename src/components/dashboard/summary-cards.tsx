import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { DashboardMetrics } from "@/lib/types";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  metrics: DashboardMetrics;
}

const cards = [
  {
    key: "revenue" as const,
    title: "총 매출",
    description: "해당 기간 전체 수입",
    icon: TrendingUp,
    iconClass: "text-emerald-600 bg-emerald-50",
    valueKey: "totalRevenue" as const,
    valueClass: "text-foreground",
  },
  {
    key: "expenses" as const,
    title: "총 비용",
    description: "해당 기간 운영 비용",
    icon: TrendingDown,
    iconClass: "text-rose-600 bg-rose-50",
    valueKey: "totalExpenses" as const,
    valueClass: "text-foreground",
  },
  {
    key: "profit" as const,
    title: "순이익",
    description: "매출 − 비용",
    icon: CircleDollarSign,
    iconClass: "text-blue-600 bg-blue-50",
    valueKey: "netProfit" as const,
    valueClass: "",
  },
  {
    key: "capacity" as const,
    title: "투자 여력",
    description: "순이익 − 고정비 예비금",
    icon: PiggyBank,
    iconClass: "text-violet-600 bg-violet-50",
    valueKey: "investmentCapacity" as const,
    valueClass: "",
  },
];

export function SummaryCards({ metrics }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(
        ({ key, title, description, icon: Icon, iconClass, valueKey, valueClass }) => {
          const value = metrics[valueKey];
          const isProfitMetric = valueKey === "netProfit" || valueKey === "investmentCapacity";
          const profitColor =
            value >= 0 ? "text-emerald-600" : "text-rose-600";

          return (
            <Card key={key} size="sm">
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription className="mt-1">
                      {description}
                    </CardDescription>
                  </div>
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      iconClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-2xl font-semibold tracking-tight tabular-nums",
                    isProfitMetric ? profitColor : valueClass
                  )}
                >
                  {formatCurrency(value)}
                </p>
                {key === "capacity" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    예비금: {formatCurrency(metrics.fixedCostsReserve)}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        }
      )}
    </div>
  );
}
