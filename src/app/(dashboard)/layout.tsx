import { DashboardShell } from "@/components/layout/dashboard-shell";
import { FinancialProvider } from "@/contexts/financial-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FinancialProvider>
      <DashboardShell>{children}</DashboardShell>
    </FinancialProvider>
  );
}
