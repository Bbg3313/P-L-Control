export type TransactionType = "revenue" | "expense";

export interface FinancialRecord {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  type: TransactionType;
}

export interface MonthlyTotals {
  month: string;
  revenue: number;
  expenses: number;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  investmentCapacity: number;
  fixedCostsReserve: number;
  periodLabel: string;
}
