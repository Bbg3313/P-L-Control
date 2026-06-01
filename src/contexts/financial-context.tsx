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
import {
  createDefaultPersonnel,
  getPersonnelTotalMonthly,
  loadPersonnelFromStorage,
  PERSONNEL_STORAGE_KEY,
  type PersonnelEntry,
} from "@/lib/personnel";
import { normalizeFinancialRecords } from "@/lib/record-normalize";
import { SEED_RECORDS } from "@/lib/seed-data";
import type { FinancialRecord, TransactionType } from "@/lib/types";

export interface NewFinancialRecord {
  date: string;
  category: string;
  client?: string;
  description?: string;
  amount: number;
  type: TransactionType;
}

interface FinancialContextValue {
  records: FinancialRecord[];
  personnel: PersonnelEntry[];
  personnelMonthlyTotal: number;
  hydrated: boolean;
  reportingMonth: string;
  fixedCostsReserve: number;
  addRecord: (record: NewFinancialRecord) => void;
  addRecords: (records: NewFinancialRecord[]) => void;
  removeRecord: (id: string) => void;
  updatePersonnel: (personnel: PersonnelEntry[]) => void;
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
    return Array.isArray(parsed)
      ? normalizeFinancialRecords(parsed)
      : SEED_RECORDS;
  } catch {
    return SEED_RECORDS;
  }
}

export function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<FinancialRecord[]>(SEED_RECORDS);
  const [personnel, setPersonnel] = useState<PersonnelEntry[]>(
    createDefaultPersonnel
  );
  const [hydrated, setHydrated] = useState(false);
  const reportingMonth = useMemo(() => getCurrentYearMonth(), []);

  const personnelMonthlyTotal = useMemo(
    () => getPersonnelTotalMonthly(personnel),
    [personnel]
  );

  useEffect(() => {
    setRecords(loadRecords());
    setPersonnel(loadPersonnelFromStorage());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PERSONNEL_STORAGE_KEY, JSON.stringify(personnel));
  }, [personnel, hydrated]);

  const toFinancialRecord = useCallback(
    (input: NewFinancialRecord): FinancialRecord =>
      normalizeFinancialRecords([
        {
          id: crypto.randomUUID(),
          date: input.date,
          category: input.category.trim(),
          client: (input.client ?? "").trim(),
          description: (input.description ?? "").trim(),
          amount: input.amount,
          type: input.type,
        },
      ])[0],
    []
  );

  const addRecord = useCallback(
    (input: NewFinancialRecord) => {
      setRecords((prev) => [...prev, toFinancialRecord(input)]);
    },
    [toFinancialRecord]
  );

  const addRecords = useCallback(
    (inputs: NewFinancialRecord[]) => {
      if (inputs.length === 0) return;
      const created = inputs.map((input) => toFinancialRecord(input));
      setRecords((prev) => [...prev, ...created]);
    },
    [toFinancialRecord]
  );

  const removeRecord = useCallback((id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updatePersonnel = useCallback((next: PersonnelEntry[]) => {
    setPersonnel(next);
  }, []);

  const resetToSeed = useCallback(() => {
    setRecords(SEED_RECORDS);
    setPersonnel(createDefaultPersonnel());
  }, []);

  const getByType = useCallback(
    (type: TransactionType) =>
      sortRecordsByDateDesc(records.filter((r) => r.type === type)),
    [records]
  );

  const value = useMemo(
    () => ({
      records,
      personnel,
      personnelMonthlyTotal,
      hydrated,
      reportingMonth,
      fixedCostsReserve: FIXED_COSTS_RESERVE,
      addRecord,
      addRecords,
      removeRecord,
      updatePersonnel,
      resetToSeed,
      getByType,
    }),
    [
      records,
      personnel,
      personnelMonthlyTotal,
      hydrated,
      reportingMonth,
      addRecord,
      addRecords,
      removeRecord,
      updatePersonnel,
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
