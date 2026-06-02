"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getCurrentYearMonth,
  getOperatingReserve,
  resolveReportingMonth,
  sortRecordsByDateDesc,
} from "@/lib/calculations";
import {
  REPORTING_MONTH_STORAGE_KEY,
  STORAGE_KEY,
} from "@/lib/constants";
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
import {
  fetchWorkspaceFromApi,
  saveWorkspaceToApi,
} from "@/lib/workspace-client";

export interface NewFinancialRecord {
  date: string;
  category: string;
  client?: string;
  description?: string;
  amount: number;
  type: TransactionType;
  /** 계산서 발행(포함)=true */
  amountIncludesVat?: boolean;
}

export type DataSyncStatus = "loading" | "cloud" | "local-only" | "error";

interface FinancialContextValue {
  records: FinancialRecord[];
  personnel: PersonnelEntry[];
  personnelMonthlyTotal: number;
  hydrated: boolean;
  syncStatus: DataSyncStatus;
  reportingMonth: string;
  setReportingMonth: (yearMonth: string) => void;
  fixedCostsReserve: number;
  addRecord: (record: NewFinancialRecord) => void;
  addRecords: (records: NewFinancialRecord[]) => void;
  removeRecord: (id: string) => void;
  updateRecord: (id: string, input: Partial<NewFinancialRecord>) => void;
  updatePersonnel: (personnel: PersonnelEntry[]) => void;
  resetToSeed: () => void;
  getByType: (type: TransactionType) => FinancialRecord[];
}

const FinancialContext = createContext<FinancialContextValue | null>(null);

function loadRecordsFromLocal(): FinancialRecord[] {
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

function loadReportingMonthFromLocal(
  records: FinancialRecord[]
): string {
  try {
    const saved = localStorage.getItem(REPORTING_MONTH_STORAGE_KEY);
    if (saved && /^\d{4}-\d{2}$/.test(saved)) {
      return resolveReportingMonth(records, saved);
    }
  } catch {
    /* ignore */
  }
  return resolveReportingMonth(records, null);
}

export function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<FinancialRecord[]>(SEED_RECORDS);
  const [personnel, setPersonnel] = useState<PersonnelEntry[]>(
    createDefaultPersonnel
  );
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<DataSyncStatus>("loading");
  const [reportingMonth, setReportingMonthState] = useState(() =>
    getCurrentYearMonth()
  );
  const cloudEnabled = useRef(false);

  const setReportingMonth = useCallback((yearMonth: string) => {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) return;
    setReportingMonthState(yearMonth);
    if (typeof window !== "undefined") {
      localStorage.setItem(REPORTING_MONTH_STORAGE_KEY, yearMonth);
    }
  }, []);

  const personnelMonthlyTotal = useMemo(
    () => getPersonnelTotalMonthly(personnel),
    [personnel]
  );

  const fixedCostsReserve = useMemo(
    () =>
      getOperatingReserve(records, reportingMonth, personnelMonthlyTotal),
    [records, reportingMonth, personnelMonthlyTotal]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const localRecords = loadRecordsFromLocal();
      const localPersonnel = loadPersonnelFromStorage();
      const localReporting = loadReportingMonthFromLocal(localRecords);

      const api = await fetchWorkspaceFromApi();

      if (cancelled) return;

      if (api?.cloudConfigured) {
        let { records: cloudRecords, personnel: cloudPersonnel } = api.snapshot;
        let cloudReporting =
          api.snapshot.reportingMonth ?? localReporting;

        const localHasData = localRecords.length > 0;
        const cloudEmpty = cloudRecords.length === 0;

        if (cloudEmpty && localHasData) {
          await saveWorkspaceToApi({
            records: localRecords,
            personnel: localPersonnel,
            reportingMonth: localReporting,
          });
          cloudRecords = localRecords;
          cloudPersonnel = localPersonnel;
          cloudReporting = localReporting;
        }

        setRecords(cloudRecords);
        setPersonnel(cloudPersonnel);
        setReportingMonthState(
          resolveReportingMonth(cloudRecords, cloudReporting)
        );
        cloudEnabled.current = true;
        setSyncStatus("cloud");
      } else {
        setRecords(localRecords);
        setPersonnel(localPersonnel);
        setReportingMonthState(localReporting);
        cloudEnabled.current = false;
        setSyncStatus(api ? "local-only" : "local-only");
      }

      setHydrated(true);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PERSONNEL_STORAGE_KEY, JSON.stringify(personnel));
  }, [personnel, hydrated]);

  useEffect(() => {
    if (!hydrated || !cloudEnabled.current) return;

    const timer = setTimeout(async () => {
      const result = await saveWorkspaceToApi({
        records,
        personnel,
        reportingMonth,
      });
      setSyncStatus(result.ok ? "cloud" : "error");
    }, 800);

    return () => clearTimeout(timer);
  }, [records, personnel, reportingMonth, hydrated]);

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
          amountIncludesVat: input.amountIncludesVat ?? false,
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

  const updateRecord = useCallback(
    (id: string, input: Partial<NewFinancialRecord>) => {
      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          return normalizeFinancialRecords([
            {
              ...r,
              date: input.date ?? r.date,
              category: input.category?.trim() ?? r.category,
              client: input.client !== undefined ? input.client.trim() : r.client,
              description:
                input.description !== undefined
                  ? input.description.trim()
                  : r.description,
              amount: input.amount ?? r.amount,
              type: input.type ?? r.type,
              amountIncludesVat:
                input.amountIncludesVat !== undefined
                  ? input.amountIncludesVat
                  : r.amountIncludesVat,
            },
          ])[0];
        })
      );
    },
    []
  );

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
      syncStatus,
      reportingMonth,
      setReportingMonth,
      fixedCostsReserve,
      addRecord,
      addRecords,
      removeRecord,
      updateRecord,
      updatePersonnel,
      resetToSeed,
      getByType,
    }),
    [
      records,
      personnel,
      personnelMonthlyTotal,
      hydrated,
      syncStatus,
      reportingMonth,
      fixedCostsReserve,
      setReportingMonth,
      addRecord,
      addRecords,
      removeRecord,
      updateRecord,
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
