import { NextRequest, NextResponse } from "next/server";
import { fetchKrwExchangeRate } from "@/lib/exchange-rate-api";
import type { OverseasCurrency } from "@/lib/overseas-fx";

export async function GET(request: NextRequest) {
  const currency = request.nextUrl.searchParams.get("currency");
  const date = request.nextUrl.searchParams.get("date");

  if (currency !== "THB" && currency !== "VND") {
    return NextResponse.json(
      { error: "currency는 THB 또는 VND여야 합니다." },
      { status: 400 }
    );
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date는 YYYY-MM-DD 형식이어야 합니다." },
      { status: 400 }
    );
  }

  try {
    const result = await fetchKrwExchangeRate(currency as OverseasCurrency, date);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "환율 조회에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
