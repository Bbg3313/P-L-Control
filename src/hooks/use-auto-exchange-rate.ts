"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ExchangeRateResult } from "@/lib/exchange-rate-api";
import type { OverseasCurrency } from "@/lib/overseas-fx";

interface UseAutoExchangeRateOptions {
  currency: OverseasCurrency;
  date: string;
  enabled?: boolean;
  onRate: (rate: number, meta: ExchangeRateResult) => void;
}

export function useAutoExchangeRate({
  currency,
  date,
  enabled = true,
  onRate,
}: UseAutoExchangeRateOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ExchangeRateResult | null>(null);
  const onRateRef = useRef(onRate);

  useEffect(() => {
    onRateRef.current = onRate;
  }, [onRate]);

  const fetchRate = useCallback(async () => {
    if (!enabled || !date) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ currency, date });
      const res = await fetch(`/api/exchange-rate?${params.toString()}`);
      const data = (await res.json()) as ExchangeRateResult & { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "환율 조회 실패");
      }

      setMeta(data);
      onRateRef.current(data.rate, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "환율 조회 실패");
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [currency, date, enabled]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  return { loading, error, meta, refetch: fetchRate };
}
