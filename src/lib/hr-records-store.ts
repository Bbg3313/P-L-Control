import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  type HrEmployeeRecord,
  type HrEmployeeRecordInput,
  type HrRecordsManifest,
  normalizeHrEmployeeRecord,
} from "@/lib/hr-records-types";
import { isCloudStorageConfigured } from "@/lib/workspace-store";

const MANIFEST_REDIS_KEY = "pl-control-hr-records";
const DEV_FILE = path.join(process.cwd(), ".data", "hr-records.json");

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

export function isHrRecordsStorageAvailable(): boolean {
  return (
    isCloudStorageConfigured() || process.env.NODE_ENV === "development"
  );
}

function emptyManifest(): HrRecordsManifest {
  return { records: [], updatedAt: new Date().toISOString() };
}

function acquiredDateSortKey(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/** 입사일(재직 시작) 오래된 순 → 이름순 */
function sortRecords(records: HrEmployeeRecord[]): HrEmployeeRecord[] {
  return [...records].sort((a, b) => {
    const byAcquired =
      acquiredDateSortKey(a.acquiredDate) - acquiredDateSortKey(b.acquiredDate);
    if (byAcquired !== 0) return byAcquired;
    return a.name.localeCompare(b.name, "ko");
  });
}

async function readDevManifest(): Promise<HrRecordsManifest | null> {
  try {
    const raw = await fs.readFile(DEV_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<HrRecordsManifest>;
    const records = Array.isArray(parsed.records)
      ? parsed.records.map((r) =>
          normalizeHrEmployeeRecord(r as Partial<HrEmployeeRecord>)
        )
      : [];
    return {
      records: sortRecords(records),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function writeDevManifest(manifest: HrRecordsManifest): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(
    DEV_FILE,
    JSON.stringify(
      { ...manifest, records: sortRecords(manifest.records) },
      null,
      2
    ),
    "utf-8"
  );
}

async function loadManifest(): Promise<{
  manifest: HrRecordsManifest;
  backend: "redis" | "dev-file" | "unavailable";
}> {
  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    const raw = await redis.get<Partial<HrRecordsManifest>>(MANIFEST_REDIS_KEY);
    if (!raw) {
      return { manifest: emptyManifest(), backend: "redis" };
    }
    const records = Array.isArray(raw.records)
      ? raw.records.map((r) =>
          normalizeHrEmployeeRecord(r as Partial<HrEmployeeRecord>)
        )
      : [];
    return {
      manifest: {
        records: sortRecords(records),
        updatedAt: raw.updatedAt ?? new Date().toISOString(),
      },
      backend: "redis",
    };
  }

  if (process.env.NODE_ENV === "development") {
    const fromFile = await readDevManifest();
    return {
      manifest: fromFile ?? emptyManifest(),
      backend: "dev-file",
    };
  }

  return { manifest: emptyManifest(), backend: "unavailable" };
}

async function saveManifest(
  manifest: HrRecordsManifest
): Promise<"redis" | "dev-file" | "unavailable"> {
  const payload: HrRecordsManifest = {
    records: sortRecords(manifest.records),
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

export async function listHrRecords(): Promise<{
  records: HrEmployeeRecord[];
  backend: "redis" | "dev-file" | "unavailable";
}> {
  const { manifest, backend } = await loadManifest();
  return { records: manifest.records, backend };
}

export async function getHrRecord(id: string): Promise<HrEmployeeRecord | null> {
  const { records } = await listHrRecords();
  return records.find((r) => r.id === id) ?? null;
}

export async function createHrRecord(
  input: HrEmployeeRecordInput
): Promise<{
  record: HrEmployeeRecord;
  backend: "redis" | "dev-file" | "unavailable";
}> {
  if (!isHrRecordsStorageAvailable()) {
    return { record: normalizeHrEmployeeRecord({ id: "", ...input }), backend: "unavailable" };
  }

  const now = new Date().toISOString();
  const record = normalizeHrEmployeeRecord({
    id: randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  });

  const { manifest } = await loadManifest();
  manifest.records.push(record);
  const backend = await saveManifest(manifest);
  return { record, backend };
}

export async function updateHrRecord(
  id: string,
  input: HrEmployeeRecordInput
): Promise<"redis" | "dev-file" | "unavailable" | "not-found"> {
  const { manifest } = await loadManifest();
  const index = manifest.records.findIndex((r) => r.id === id);
  if (index < 0) return "not-found";

  const existing = manifest.records[index];
  manifest.records[index] = normalizeHrEmployeeRecord({
    ...existing,
    ...input,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });

  return saveManifest(manifest);
}

export async function deleteHrRecord(
  id: string
): Promise<"redis" | "dev-file" | "unavailable" | "not-found"> {
  const { manifest } = await loadManifest();
  const index = manifest.records.findIndex((r) => r.id === id);
  if (index < 0) return "not-found";

  manifest.records.splice(index, 1);
  return saveManifest(manifest);
}
