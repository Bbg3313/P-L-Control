import { DataSyncBanner } from "./data-sync-banner";
import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DataSyncBanner />
        <main className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden py-6 pl-6 pr-6 lg:py-10 lg:pl-10 lg:pr-10">
          <div className="mx-auto flex min-h-0 w-full max-w-[1320px] min-w-0 flex-1 flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
