import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  createEmptyCashflow,
  type CashflowMonth,
  type CashflowSnapshot,
  type CollectionStatus,
  type ContractStatus,
  type ExpenseMonthRow,
  type ExpenseSource,
  type ExpenseTemplate,
  type HospitalMonthRow,
  type HospitalTemplate,
} from "@/lib/cashflow-types";
import { isCloudStorageConfigured } from "@/lib/workspace-store";

const REDIS_KEY = "pl-control-cashflow";
const DEV_FILE = path.join(process.cwd(), ".data", "cashflow.json");

export const CASHFLOW_LOCAL_KEY = "pl-control-cashflow-v1";

function getRedis(): Redis {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("Redis storage is not configured");
  }
  return new Redis({ url, token });
}

export function isCashflowStorageAvailable(): boolean {
  return (
    isCloudStorageConfigured() || process.env.NODE_ENV === "development"
  );
}

function isYearMonth(key: string): boolean {
  return /^\d{4}-\d{2}$/.test(key);
}

function asMoney(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function asStatus(value: unknown): CollectionStatus {
  if (value === "paid" || value === "partial" || value === "unpaid") return value;
  return "unpaid";
}

function asContractStatus(value: unknown): ContractStatus {
  if (
    value === "외주" ||
    value === "자체" ||
    value === "보류" ||
    value === "해지"
  ) {
    return value;
  }
  return "외주";
}

function normalizeHospitalTemplate(raw: unknown): HospitalTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!id || !name) return null;
  const expectedDay =
    typeof o.expectedDay === "number" &&
    Number.isFinite(o.expectedDay) &&
    o.expectedDay >= 1 &&
    o.expectedDay <= 31
      ? Math.floor(o.expectedDay)
      : null;
  return {
    id,
    name,
    defaultAmount: asMoney(o.defaultAmount),
    expectedDay,
    contractStatus: asContractStatus(o.contractStatus),
  };
}

function asExpenseSource(value: unknown): ExpenseSource {
  if (
    value === "payroll-bbg" ||
    value === "payroll-goldfender" ||
    value === "fixed-th" ||
    value === "fixed-vn" ||
    value === "meta-daily" ||
    value === "manual"
  ) {
    return value;
  }
  return "manual";
}

function asPayDay(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 1 || n > 31) return null;
  return n;
}

function normalizeExpenseTemplate(raw: unknown): ExpenseTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!id || !name) return null;
  const dailyAmount = asMoney(o.dailyAmount);
  return {
    id,
    name,
    defaultAmount: asMoney(o.defaultAmount),
    payDay: asPayDay(o.payDay),
    source: asExpenseSource(o.source),
    ...(dailyAmount > 0 ? { dailyAmount } : {}),
  };
}

function normalizeHospitalRow(raw: unknown): HospitalMonthRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!id) return null;
  return {
    id,
    name,
    contractStatus: asContractStatus(o.contractStatus),
    amount: asMoney(o.amount),
    receivedAmount: asMoney(o.receivedAmount),
    status: asStatus(o.status),
    paidDate:
      typeof o.paidDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.paidDate)
        ? o.paidDate
        : "",
    note: typeof o.note === "string" ? o.note : "",
  };
}

function normalizeExpenseRow(raw: unknown): ExpenseMonthRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return null;
  const dailyAmount = asMoney(o.dailyAmount);
  return {
    id,
    name: typeof o.name === "string" ? o.name.trim() : "",
    amount: asMoney(o.amount),
    note: typeof o.note === "string" ? o.note : "",
    payDay: asPayDay(o.payDay),
    source: asExpenseSource(o.source),
    ...(dailyAmount > 0 ? { dailyAmount } : {}),
  };
}

function normalizeMonth(
  yearMonth: string,
  raw: unknown
): CashflowMonth | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const hospitals = Array.isArray(o.hospitals)
    ? o.hospitals
        .map(normalizeHospitalRow)
        .filter((r): r is HospitalMonthRow => Boolean(r))
    : [];
  const expenses = Array.isArray(o.expenses)
    ? o.expenses
        .map(normalizeExpenseRow)
        .filter((r): r is ExpenseMonthRow => Boolean(r))
    : [];
  return { yearMonth, hospitals, expenses };
}

export function normalizeCashflowSnapshot(
  raw: Partial<CashflowSnapshot> | null | undefined
): CashflowSnapshot {
  const hospitals = Array.isArray(raw?.hospitals)
    ? raw!.hospitals
        .map(normalizeHospitalTemplate)
        .filter((h): h is HospitalTemplate => Boolean(h))
    : [];
  const expenseTemplates = Array.isArray(raw?.expenseTemplates)
    ? raw!.expenseTemplates
        .map(normalizeExpenseTemplate)
        .filter((e): e is ExpenseTemplate => Boolean(e))
    : [];

  const months: Record<string, CashflowMonth> = {};
  if (raw?.months && typeof raw.months === "object") {
    for (const [ym, value] of Object.entries(raw.months)) {
      if (!isYearMonth(ym)) continue;
      const month = normalizeMonth(ym, value);
      if (month) months[ym] = month;
    }
  }

  return {
    hospitals,
    expenseTemplates,
    months,
    seedVersion:
      typeof raw?.seedVersion === "number" && Number.isFinite(raw.seedVersion)
        ? Math.floor(raw.seedVersion)
        : 0,
    updatedAt:
      typeof raw?.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export function hasCashflowData(snapshot: CashflowSnapshot): boolean {
  return (
    snapshot.hospitals.length > 0 ||
    snapshot.expenseTemplates.length > 0 ||
    Object.keys(snapshot.months).length > 0
  );
}

async function readDevFile(): Promise<CashflowSnapshot | null> {
  try {
    const raw = await fs.readFile(DEV_FILE, "utf-8");
    return normalizeCashflowSnapshot(
      JSON.parse(raw) as Partial<CashflowSnapshot>
    );
  } catch {
    return null;
  }
}

async function writeDevFile(snapshot: CashflowSnapshot): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(snapshot, null, 2), "utf-8");
}

export async function loadCashflowFromStore(): Promise<{
  snapshot: CashflowSnapshot;
  backend: "redis" | "dev-file" | "empty";
}> {
  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    const raw = await redis.get<Partial<CashflowSnapshot>>(REDIS_KEY);
    if (!raw) {
      return { snapshot: createEmptyCashflow(), backend: "redis" };
    }
    return {
      snapshot: normalizeCashflowSnapshot(raw),
      backend: "redis",
    };
  }

  if (process.env.NODE_ENV === "development") {
    const fromFile = await readDevFile();
    if (fromFile) {
      return { snapshot: fromFile, backend: "dev-file" };
    }
  }

  return { snapshot: createEmptyCashflow(), backend: "empty" };
}

export async function saveCashflowToStore(
  snapshot: Partial<CashflowSnapshot>
): Promise<"redis" | "dev-file" | "unavailable"> {
  const payload = normalizeCashflowSnapshot({
    ...snapshot,
    updatedAt: new Date().toISOString(),
  });

  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    await redis.set(REDIS_KEY, payload);
    return "redis";
  }

  if (process.env.NODE_ENV === "development") {
    await writeDevFile(payload);
    return "dev-file";
  }

  return "unavailable";
}

/** 브라우저 localStorage */
export function loadCashflowLocal(): CashflowSnapshot {
  if (typeof window === "undefined") return createEmptyCashflow();
  try {
    const raw = localStorage.getItem(CASHFLOW_LOCAL_KEY);
    if (!raw) return createEmptyCashflow();
    return normalizeCashflowSnapshot(
      JSON.parse(raw) as Partial<CashflowSnapshot>
    );
  } catch {
    return createEmptyCashflow();
  }
}

export function saveCashflowLocal(snapshot: CashflowSnapshot): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CASHFLOW_LOCAL_KEY,
    JSON.stringify({
      ...snapshot,
      updatedAt: new Date().toISOString(),
    })
  );
}
