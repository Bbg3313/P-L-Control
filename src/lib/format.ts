const numberFormatter = new Intl.NumberFormat("ko-KR", {
  useGrouping: true,
  maximumFractionDigits: 0,
});

/** 천 단위 콤마 (₩ 기호 없음) */
export function formatNumber(amount: number): string {
  return numberFormatter.format(Math.abs(amount));
}

/** 금액 입력란 표시용 — 0이면 빈 문자열 */
export function formatAmountInputValue(amount: number): string {
  return amount > 0 ? formatNumber(amount) : "";
}

/** 입력 중 천 단위 콤마 정규화 (parseAmountInput과 함께 사용) */
export function normalizeAmountInputString(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return formatNumber(Number(digits));
}

export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}₩ ${formatNumber(amount)}`;
}

export interface CurrencyParts {
  sign: "" | "−";
  symbol: "₩";
  value: string;
}

export function getCurrencyParts(amount: number): CurrencyParts {
  return {
    sign: amount < 0 ? "−" : "",
    symbol: "₩",
    value: formatNumber(amount),
  };
}

/** 차트 Y축·툴팁용 간략 표기 */
export function formatCompactCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";

  if (abs >= 100_000_000) {
    const eok = abs / 100_000_000;
    const formatted =
      eok >= 10 || eok % 1 === 0
        ? formatNumber(Math.round(eok))
        : eok.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
    return `${sign}${formatted}억`;
  }
  if (abs >= 10_000_000) {
    return `${sign}${formatNumber(Math.round(abs / 10_000_000))}천만`;
  }
  if (abs >= 10_000) {
    return `${sign}${formatNumber(Math.round(abs / 10_000))}만`;
  }
  return formatCurrency(amount);
}
