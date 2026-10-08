import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PinLockGate } from "@/components/layout/pin-lock-gate";
import { FinancialProvider } from "@/contexts/financial-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PinLockGate>
      <FinancialProvider>
        <DashboardShell>{children}</DashboardShell>
      </FinancialProvider>
    </PinLockGate>
  );
}
