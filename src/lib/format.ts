const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** 차트 축·툴팁용 간략 표기 (억원 / 만원) */
export function formatCompactCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 100_000_000) {
    const eok = amount / 100_000_000;
    const formatted =
      Math.abs(eok) >= 10 || eok % 1 === 0
        ? eok.toFixed(0)
        : eok.toFixed(1);
    return `${formatted}억원`;
  }
  if (abs >= 10_000) {
    const man = Math.round(amount / 10_000);
    return `${man.toLocaleString("ko-KR")}만원`;
  }
  return formatCurrency(amount);
}
