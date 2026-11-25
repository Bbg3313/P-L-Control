import { DataSyncBanner } from "./data-sync-banner";
import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[#f5f7f9]">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DataSyncBanner />
        <main className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden px-5 py-5 lg:px-8 lg:py-6">
          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
