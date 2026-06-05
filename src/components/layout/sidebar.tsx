"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Users,
  Settings,
} from "lucide-react";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { APP_COMPANY_NAME, APP_LOGO_ALT, APP_LOGO_SRC, APP_SUBTITLE } from "@/lib/brand";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** true면 href와 pathname이 정확히 일치할 때만 활성 */
  exact?: boolean;
  indent?: boolean;
};

const navItems: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/revenue", label: "매출", icon: TrendingUp },
  { href: "/expenses", label: "비용", icon: TrendingDown },
  { href: "/hr", label: "인사", icon: Users, exact: true },
  { href: "/hr/records", label: "인사기록부", icon: ClipboardList, indent: true },
  { href: "/settings", label: "설정", icon: Settings },
];

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <Link
        href="/"
        className="flex items-center gap-3 border-b border-sidebar-border px-4 py-5 transition-colors hover:bg-sidebar-accent/40"
      >
        <Image
          src={APP_LOGO_SRC}
          alt={APP_LOGO_ALT}
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 object-contain"
          priority
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug tracking-tight">
            {APP_COMPANY_NAME}
          </p>
          <p className="text-xs text-muted-foreground">{APP_SUBTITLE}</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const { href, label, icon: Icon, indent } = item;
          const isActive = isNavActive(pathname, item);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                indent ? "pl-8 pr-3" : "px-3",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <ReportingMonthNav compact showQuickMonths={false} />
      </div>
    </aside>
  );
}
