"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CollapsibleExpenseCardProps {
  title: string;
  description: string;
  amount: number;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleExpenseCard({
  title,
  description,
  amount,
  meta,
  defaultOpen = false,
  children,
}: CollapsibleExpenseCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 sm:items-center sm:px-6"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform sm:mt-0",
            open && "rotate-180"
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold">{title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-xl font-semibold tabular-nums sm:text-2xl">
                {formatCurrency(amount)}
              </p>
              {meta && (
                <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
              )}
            </div>
          </div>
        </div>
      </button>

      {open && (
        <CardContent className="border-t border-border/60 pt-4">{children}</CardContent>
      )}
    </Card>
  );
}
