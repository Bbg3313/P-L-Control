import { DataSyncBanner } from "./data-sync-banner";
import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DataSyncBanner />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
