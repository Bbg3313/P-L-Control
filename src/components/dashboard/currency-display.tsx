import { getCurrencyParts } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
  valueClassName?: string;
  symbolClassName?: string;
}

/** ₩ 와 숫자 사이 간격, 콤마 포맷이 적용된 금액 표시 */
export function CurrencyDisplay({
  amount,
  className,
  valueClassName,
  symbolClassName,
}: CurrencyDisplayProps) {
  const { sign, symbol, value } = getCurrencyParts(amount);

  return (
    <span className={cn("inline-flex items-baseline gap-0.5 tabular-nums", className)}>
      {sign && (
        <span className="mr-0.5 text-[0.75em] font-medium text-muted-foreground">
          {sign}
        </span>
      )}
      <span
        className={cn(
          "text-[0.72em] font-medium tracking-wide text-slate-500",
          symbolClassName
        )}
      >
        {symbol}
      </span>
      <span className={cn("ml-1 tracking-tight", valueClassName)}>{value}</span>
    </span>
  );
}
