const numberFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});

/** 천 단위 콤마 + ₩ 기호와 숫자 사이 공백 */
export function formatNumber(amount: number): string {
  return numberFormatter.format(Math.abs(amount));
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
      eok >= 10 || eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(1);
    return `${sign}${formatted}억`;
  }
  if (abs >= 10_000_000) {
    return `${sign}${Math.round(abs / 10_000_000)}천만`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만`;
  }
  return formatCurrency(amount);
}
