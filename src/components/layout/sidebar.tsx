"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Settings,
} from "lucide-react";
import { ReportingMonthNav } from "@/components/dashboard/reporting-month-nav";
import { APP_LOGO_ALT, APP_LOGO_SRC, APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/revenue", label: "매출", icon: TrendingUp },
  { href: "/expenses", label: "비용", icon: TrendingDown },
  { href: "/settings", label: "설정", icon: Settings },
] as const;

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
            {APP_NAME}
          </p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
