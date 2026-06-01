import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { getCurrentYearMonth } from "@/lib/calculations";
import {
  createDefaultPersonnel,
  normalizePersonnelList,
} from "@/lib/personnel";
import { normalizeFinancialRecords } from "@/lib/record-normalize";
import { SEED_RECORDS } from "@/lib/seed-data";
import {
  WORKSPACE_KV_KEY,
  type WorkspaceSnapshot,
} from "@/lib/workspace-types";

const DEV_FILE = path.join(process.cwd(), ".data", "workspace.json");

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
}

export function isCloudStorageConfigured(): boolean {
  return Boolean(getRedisUrl() && getRedisToken());
}

function getRedis(): Redis {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) {
    throw new Error("Redis storage is not configured");
  }
  return new Redis({ url, token });
}

export function createEmptyWorkspace(): WorkspaceSnapshot {
  return {
    records: SEED_RECORDS,
    personnel: createDefaultPersonnel(),
    reportingMonth: getCurrentYearMonth(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeSnapshot(raw: Partial<WorkspaceSnapshot>): WorkspaceSnapshot {
  return {
    records: normalizeFinancialRecords(
      Array.isArray(raw.records) ? raw.records : []
    ),
    personnel: normalizePersonnelList(raw.personnel),
    reportingMonth:
      raw.reportingMonth && /^\d{4}-\d{2}$/.test(raw.reportingMonth)
        ? raw.reportingMonth
        : getCurrentYearMonth(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

async function readDevFile(): Promise<WorkspaceSnapshot | null> {
  try {
    const raw = await fs.readFile(DEV_FILE, "utf-8");
    return normalizeSnapshot(JSON.parse(raw) as Partial<WorkspaceSnapshot>);
  } catch {
    return null;
  }
}

async function writeDevFile(snapshot: WorkspaceSnapshot): Promise<void> {
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(snapshot, null, 2), "utf-8");
}

export async function loadWorkspaceFromStore(): Promise<{
  snapshot: WorkspaceSnapshot;
  backend: "redis" | "dev-file" | "empty";
}> {
  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    const raw = await redis.get<Partial<WorkspaceSnapshot>>(WORKSPACE_KV_KEY);
    if (!raw) {
      return { snapshot: createEmptyWorkspace(), backend: "redis" };
    }
    return { snapshot: normalizeSnapshot(raw), backend: "redis" };
  }

  if (process.env.NODE_ENV === "development") {
    const fromFile = await readDevFile();
    if (fromFile) {
      return { snapshot: fromFile, backend: "dev-file" };
    }
  }

  return { snapshot: createEmptyWorkspace(), backend: "empty" };
}

export async function saveWorkspaceToStore(
  snapshot: Partial<WorkspaceSnapshot>
): Promise<"redis" | "dev-file" | "unavailable"> {
  const payload = normalizeSnapshot({
    ...snapshot,
    updatedAt: new Date().toISOString(),
  });

  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    await redis.set(WORKSPACE_KV_KEY, payload);
    return "redis";
  }

  if (process.env.NODE_ENV === "development") {
    await writeDevFile(payload);
    return "dev-file";
  }

  return "unavailable";
}

export function hasWorkspaceData(snapshot: WorkspaceSnapshot): boolean {
  return snapshot.records.length > 0;
}
