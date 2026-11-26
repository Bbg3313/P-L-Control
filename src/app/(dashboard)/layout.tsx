import { SessionAuthGate } from "@/components/auth/session-auth-gate";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { FinancialProvider } from "@/contexts/financial-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionAuthGate>
      <FinancialProvider>
        <DashboardShell>{children}</DashboardShell>
      </FinancialProvider>
    </SessionAuthGate>
  );
}
