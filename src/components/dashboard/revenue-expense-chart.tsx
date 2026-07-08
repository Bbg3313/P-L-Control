"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import type { MonthlyTotals } from "@/lib/types";

const CHART = {
  revenue: "#14b8a6",
  expense: "#f43f5e",
  grid: "#e2e8f0",
  axis: "#94a3b8",
  font: "var(--font-pretendard), Pretendard, system-ui, sans-serif",
};

interface RevenueExpenseChartProps {
  data: MonthlyTotals[];
  monthLabels: Record<string, string>;
  subtitle?: string;
}

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 shadow-md">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <ul className="space-y-1.5">
        {payload.map((entry) => (
          <li
            key={entry.dataKey}
            className="flex items-center justify-between gap-6 text-sm"
          >
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-slate-900">
              {formatCurrency(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RevenueExpenseChart({
  data,
  monthLabels,
  subtitle = "최근 추이",
}: RevenueExpenseChartProps) {
  const chartData = data.map((row) => ({
    name: monthLabels[row.month] ?? row.month,
    revenue: row.revenue,
    expenses: row.expenses,
  }));

  const maxValue = Math.max(
    0,
    ...chartData.flatMap((d) => [d.revenue, d.expenses])
  );
  const yDomain: [number, number] = [0, maxValue * 1.12 || 1];

  return (
    <Card className="border-slate-200/80 bg-white shadow-sm ring-0">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="text-base font-semibold text-slate-900">
          매출 vs 비용
        </CardTitle>
        <CardDescription className="text-sm text-slate-500">
          {subtitle}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-6 sm:px-6">
        <div className="h-[340px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barGap={6}
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                stroke={CHART.grid}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: CHART.axis, fontFamily: CHART.font }}
                tickLine={false}
                axisLine={{ stroke: CHART.grid }}
                dy={8}
              />
              <YAxis
                width={52}
                tick={{ fontSize: 11, fill: CHART.axis, fontFamily: CHART.font }}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                domain={yDomain}
                tickFormatter={(v) => formatCompactCurrency(Number(v))}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              />
              <Legend
                wrapperStyle={{ paddingTop: 16 }}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-sm text-slate-600">{value}</span>
                )}
              />
              <Bar
                dataKey="revenue"
                name="매출"
                fill={CHART.revenue}
                barSize={32}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                name="비용"
                fill={CHART.expense}
                barSize={32}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
