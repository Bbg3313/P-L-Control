import type { OverseasCurrency } from "@/lib/overseas-fx";

export interface ExchangeRateResult {
  currency: OverseasCurrency;
  date: string;
  /** 1 현지통화당 원화 */
  rate: number;
  requestedDate: string;
  usedDate: string;
  source: string;
}

function clampDateToToday(date: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return date > today ? today : date;
}

async function fetchFromCurrencyApi(
  currency: OverseasCurrency,
  date: string
): Promise<number | null> {
  const code = currency.toLowerCase();
  const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${code}.json`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, { krw?: number }>;
  const rate = data[code]?.krw;
  if (typeof rate !== "number" || rate <= 0) return null;

  return rate;
}

/** 기준일 환율 조회 (1 THB/VND = X KRW) */
export async function fetchKrwExchangeRate(
  currency: OverseasCurrency,
  date: string
): Promise<ExchangeRateResult> {
  const requestedDate = date;
  const primaryDate = clampDateToToday(date);

  let rate = await fetchFromCurrencyApi(currency, primaryDate);
  let usedDate = primaryDate;

  if (rate === null && primaryDate !== "latest") {
    rate = await fetchFromCurrencyApi(currency, "latest");
    usedDate = "latest";
  }

  if (rate === null) {
    throw new Error(`${currency} 환율을 가져오지 못했습니다.`);
  }

  return {
    currency,
    date: requestedDate,
    rate,
    requestedDate,
    usedDate,
    source: "currency-api (jsDelivr)",
  };
}
