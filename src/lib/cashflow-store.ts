import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  hasCashflowData,
  normalizeCashflowSnapshot,
} from "@/lib/cashflow-normalize";
import { createEmptyCashflow, type CashflowSnapshot } from "@/lib/cashflow-types";
import { isCloudStorageConfigured } from "@/lib/workspace-store";

export { hasCashflowData, normalizeCashflowSnapshot };

const REDIS_KEY = "pl-control-cashflow";
const DEV_FILE = path.join(process.cwd(), ".data", "cashflow.json");

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
