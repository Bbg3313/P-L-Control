import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  type PayrollNoteOverrides,
  type PayrollOverridesSnapshot,
  type PayrollPerformancePayOverrides,
} from "@/lib/payroll-ledger-store";
import { isCloudStorageConfigured } from "@/lib/workspace-store";

const REDIS_KEY = "pl-control-payroll-overrides";
const DEV_FILE = path.join(process.cwd(), ".data", "payroll-overrides.json");

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

export function isPayrollOverridesStorageAvailable(): boolean {
  return (
    isCloudStorageConfigured() || process.env.NODE_ENV === "development"
  );
}

function isYearMonth(key: string): boolean {
  return /^\d{4}-\d{2}$/.test(key);
}

function normalizePerformancePay(
  raw: unknown
): PayrollPerformancePayOverrides {
  if (!raw || typeof raw !== "object") return {};
  const out: PayrollPerformancePayOverrides = {};
  for (const [yearMonth, people] of Object.entries(
    raw as Record<string, unknown>
  )) {
    if (!isYearMonth(yearMonth) || !people || typeof people !== "object") {
      continue;
    }
    const month: Record<string, number> = {};
    for (const [personId, value] of Object.entries(
      people as Record<string, unknown>
    )) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        month[personId] = Math.floor(value);
      }
    }
    if (Object.keys(month).length > 0) out[yearMonth] = month;
  }
  return out;
}

function normalizeNotes(raw: unknown): PayrollNoteOverrides {
  if (!raw || typeof raw !== "object") return {};
  const out: PayrollNoteOverrides = {};
  for (const [yearMonth, people] of Object.entries(
    raw as Record<string, unknown>
  )) {
    if (!isYearMonth(yearMonth) || !people || typeof people !== "object") {
      continue;
    }
    const month: Record<string, string> = {};
    for (const [personId, value] of Object.entries(
      people as Record<string, unknown>
    )) {
      if (typeof value === "string" && value.trim()) {
        month[personId] = value.trim();
      }
    }
    if (Object.keys(month).length > 0) out[yearMonth] = month;
  }
  return out;
}

export function createEmptyPayrollOverrides(): PayrollOverridesSnapshot {
  return {
    performancePay: {},
    notes: {},
    updatedAt: new Date().toISOString(),
  };
}

export function normalizePayrollOverridesSnapshot(
  raw: Partial<PayrollOverridesSnapshot> | null | undefined
): PayrollOverridesSnapshot {
  return {
    performancePay: normalizePerformancePay(raw?.performancePay),
    notes: normalizeNotes(raw?.notes),
    updatedAt:
      typeof raw?.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export function hasOverrideData(snapshot: PayrollOverridesSnapshot): boolean {
  return (
    Object.keys(snapshot.performancePay).length > 0 ||
    Object.keys(snapshot.notes).length > 0
  );
}

async function readDevFile(): Promise<PayrollOverridesSnapshot | null> {
  try {
    const raw = await fs.readFile(DEV_FILE, "utf-8");
    return normalizePayrollOverridesSnapshot(
      JSON.parse(raw) as Partial<PayrollOverridesSnapshot>
    );
  } catch {
    return null;
  }
}

async function writeDevFile(snapshot: PayrollOverridesSnapshot): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(snapshot, null, 2), "utf-8");
}

export async function loadPayrollOverridesFromStore(): Promise<{
  snapshot: PayrollOverridesSnapshot;
  backend: "redis" | "dev-file" | "empty";
}> {
  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    const raw = await redis.get<Partial<PayrollOverridesSnapshot>>(REDIS_KEY);
    if (!raw) {
      return { snapshot: createEmptyPayrollOverrides(), backend: "redis" };
    }
    return {
      snapshot: normalizePayrollOverridesSnapshot(raw),
      backend: "redis",
    };
  }

  if (process.env.NODE_ENV === "development") {
    const fromFile = await readDevFile();
    if (fromFile) {
      return { snapshot: fromFile, backend: "dev-file" };
    }
  }

  return { snapshot: createEmptyPayrollOverrides(), backend: "empty" };
}

export async function savePayrollOverridesToStore(
  snapshot: Partial<PayrollOverridesSnapshot>
): Promise<"redis" | "dev-file" | "unavailable"> {
  const payload = normalizePayrollOverridesSnapshot({
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
