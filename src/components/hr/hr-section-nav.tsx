"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/hr", label: "서류" },
  { href: "/hr/records", label: "인사기록부" },
] as const;

export function HrSectionNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex gap-1 rounded-lg border border-slate-200/80 bg-white p-1 shadow-sm">
      {tabs.map(({ href, label }) => {
        const isActive =
          href === "/hr"
            ? pathname === "/hr"
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors",
              isActive
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
