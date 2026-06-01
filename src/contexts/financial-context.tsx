"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getCurrentYearMonth,
  sortRecordsByDateDesc,
} from "@/lib/calculations";
import { FIXED_COSTS_RESERVE, STORAGE_KEY } from "@/lib/constants";
import { SEED_RECORDS } from "@/lib/seed-data";
import type { FinancialRecord, TransactionType } from "@/lib/types";

export interface NewFinancialRecord {
  date: string;
  category: string;
  description: string;
  amount: number;
  type: TransactionType;
}

interface FinancialContextValue {
  records: FinancialRecord[];
  hydrated: boolean;
  reportingMonth: string;
  fixedCostsReserve: number;
  addRecord: (record: NewFinancialRecord) => void;
  removeRecord: (id: string) => void;
  resetToSeed: () => void;
  getByType: (type: TransactionType) => FinancialRecord[];
}

const FinancialContext = createContext<FinancialContextValue | null>(null);

function loadRecords(): FinancialRecord[] {
  if (typeof window === "undefined") return SEED_RECORDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_RECORDS;
    const parsed = JSON.parse(raw) as FinancialRecord[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_RECORDS;
  } catch {
    return SEED_RECORDS;
  }
}

export function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<FinancialRecord[]>(SEED_RECORDS);
  const [hydrated, setHydrated] = useState(false);
  const reportingMonth = useMemo(() => getCurrentYearMonth(), []);

  useEffect(() => {
    setRecords(loadRecords());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records, hydrated]);

  const addRecord = useCallback((input: NewFinancialRecord) => {
    const record: FinancialRecord = {
      ...input,
      id: crypto.randomUUID(),
      category: input.category.trim(),
      description: input.description.trim(),
    };
    setRecords((prev) => [...prev, record]);
  }, []);

  const removeRecord = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const resetToSeed = useCallback(() => {
    setRecords(SEED_RECORDS);
  }, []);

  const getByType = useCallback(
    (type: TransactionType) =>
      sortRecordsByDateDesc(records.filter((r) => r.type === type)),
    [records]
  );

  const value = useMemo(
    () => ({
      records,
      hydrated,
      reportingMonth,
      fixedCostsReserve: FIXED_COSTS_RESERVE,
      addRecord,
      removeRecord,
      resetToSeed,
      getByType,
    }),
    [
      records,
      hydrated,
      reportingMonth,
      addRecord,
      removeRecord,
      resetToSeed,
      getByType,
    ]
  );

  return (
    <FinancialContext.Provider value={value}>
      {children}
    </FinancialContext.Provider>
  );
}

export function useFinancial() {
  const ctx = useContext(FinancialContext);
  if (!ctx) {
    throw new Error("useFinancial은 FinancialProvider 안에서 사용해야 합니다.");
  }
  return ctx;
}
