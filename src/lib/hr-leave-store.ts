import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  type HrLeaveEntry,
  type HrLeaveManifest,
  type HrLeaveUsage,
  normalizeHrLeaveUsage,
} from "@/lib/hr-leave-types";
import { isCloudStorageConfigured } from "@/lib/workspace-store";

const MANIFEST_REDIS_KEY = "pl-control-hr-leave";
const DEV_FILE = path.join(process.cwd(), ".data", "hr-leave.json");

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

export function isHrLeaveStorageAvailable(): boolean {
  return (
    isCloudStorageConfigured() || process.env.NODE_ENV === "development"
  );
}

function emptyManifest(): HrLeaveManifest {
  return { usages: [], updatedAt: new Date().toISOString() };
}

async function readDevManifest(): Promise<HrLeaveManifest | null> {
  try {
    const raw = await fs.readFile(DEV_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<HrLeaveManifest>;
    const usages = Array.isArray(parsed.usages)
      ? parsed.usages.map((u) => normalizeHrLeaveUsage(u))
      : [];
    return {
      usages,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function writeDevManifest(manifest: HrLeaveManifest): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(manifest, null, 2), "utf-8");
}

async function loadManifest(): Promise<HrLeaveManifest> {
  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    const raw = await redis.get<Partial<HrLeaveManifest>>(MANIFEST_REDIS_KEY);
    if (!raw) return emptyManifest();
    const usages = Array.isArray(raw.usages)
      ? raw.usages.map((u) => normalizeHrLeaveUsage(u))
      : [];
    return {
      usages,
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
    };
  }

  if (process.env.NODE_ENV === "development") {
    return (await readDevManifest()) ?? emptyManifest();
  }

  return emptyManifest();
}

async function saveManifest(
  manifest: HrLeaveManifest
): Promise<"redis" | "dev-file" | "unavailable"> {
  const payload: HrLeaveManifest = {
    usages: manifest.usages,
    updatedAt: new Date().toISOString(),
  };

  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    await redis.set(MANIFEST_REDIS_KEY, payload);
    return "redis";
  }

  if (process.env.NODE_ENV === "development") {
    await writeDevManifest(payload);
    return "dev-file";
  }

  return "unavailable";
}

export async function listHrLeaveUsages(): Promise<HrLeaveUsage[]> {
  const manifest = await loadManifest();
  return manifest.usages;
}

export async function upsertHrLeaveEntries(
  employeeId: string,
  entries: HrLeaveEntry[]
): Promise<"redis" | "dev-file" | "unavailable"> {
  const manifest = await loadManifest();
  const index = manifest.usages.findIndex((u) => u.employeeId === employeeId);
  const entry = normalizeHrLeaveUsage({
    employeeId,
    entries,
    updatedAt: new Date().toISOString(),
  });

  if (index >= 0) {
    manifest.usages[index] = entry;
  } else {
    manifest.usages.push(entry);
  }

  return saveManifest(manifest);
}
