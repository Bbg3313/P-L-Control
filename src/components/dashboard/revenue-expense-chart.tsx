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
import { formatCompactCurrency } from "@/lib/format";
import type { MonthlyTotals } from "@/lib/types";

interface RevenueExpenseChartProps {
  data: MonthlyTotals[];
  monthLabels: Record<string, string>;
}

export function RevenueExpenseChart({
  data,
  monthLabels,
}: RevenueExpenseChartProps) {
  const chartData = data.map((row) => ({
    name: monthLabels[row.month] ?? row.month,
    revenue: row.revenue,
    expenses: row.expenses,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>매출 vs 비용</CardTitle>
        <CardDescription>
          최근 6개월 월별 비교 (마케팅 에이전시 운영)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCompactCurrency(Number(v))}
              />
              <Tooltip
                formatter={(value) => [
                  formatCompactCurrency(Number(value ?? 0)),
                  "",
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                }}
              />
              <Legend />
              <Bar
                dataKey="revenue"
                name="매출"
                fill="hsl(142 76% 36%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                name="비용"
                fill="hsl(0 72% 51%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
