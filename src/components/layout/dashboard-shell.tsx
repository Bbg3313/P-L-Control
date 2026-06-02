import { DataSyncBanner } from "./data-sync-banner";
import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DataSyncBanner />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-6 lg:p-10">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
