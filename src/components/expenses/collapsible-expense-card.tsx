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
    <Card className="min-w-0 !overflow-visible">
      <button
        type="button"
        className="flex w-full min-w-0 items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 sm:items-center sm:px-6"
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
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-semibold">{title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="min-w-0 sm:shrink-0 sm:text-right">
              <p className="text-lg font-semibold tabular-nums sm:text-2xl">
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
        <CardContent className="min-w-0 overflow-visible border-t border-border/60 px-4 pt-4 sm:px-6">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
