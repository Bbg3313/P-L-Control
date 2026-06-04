import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  type HrDocumentCategory,
  type HrDocumentMeta,
  type HrDocumentsManifest,
  normalizeHrDocumentMeta,
  type HrSalaryExtractStatus,
} from "@/lib/hr-documents-types";
import { isCloudStorageConfigured } from "@/lib/workspace-store";

const MANIFEST_REDIS_KEY = "pl-control-hr-manifest";
const fileRedisKey = (id: string) => `pl-control-hr-file:${id}`;

const DEV_DIR = path.join(process.cwd(), ".data", "hr-documents");
const DEV_MANIFEST = path.join(DEV_DIR, "manifest.json");
const DEV_FILES_DIR = path.join(DEV_DIR, "files");

import { HR_DOCUMENT_MAX_BYTES } from "@/lib/hr-file-utils";

export { HR_DOCUMENT_MAX_BYTES };

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

export function isHrDocumentsStorageAvailable(): boolean {
  return (
    isCloudStorageConfigured() || process.env.NODE_ENV === "development"
  );
}

function emptyManifest(): HrDocumentsManifest {
  return { documents: [], updatedAt: new Date().toISOString() };
}

function sortDocuments(docs: HrDocumentMeta[]): HrDocumentMeta[] {
  return [...docs].sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

async function readDevManifest(): Promise<HrDocumentsManifest | null> {
  try {
    const raw = await fs.readFile(DEV_MANIFEST, "utf-8");
    const parsed = JSON.parse(raw) as Partial<HrDocumentsManifest>;
    const documents = Array.isArray(parsed.documents)
      ? parsed.documents.map((d) =>
          normalizeHrDocumentMeta(d as Partial<HrDocumentMeta>)
        )
      : [];
    return {
      documents: sortDocuments(documents),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function writeDevManifest(manifest: HrDocumentsManifest): Promise<void> {
  await fs.mkdir(DEV_DIR, { recursive: true });
  await fs.writeFile(
    DEV_MANIFEST,
    JSON.stringify(
      { ...manifest, documents: sortDocuments(manifest.documents) },
      null,
      2
    ),
    "utf-8"
  );
}

async function loadManifest(): Promise<{
  manifest: HrDocumentsManifest;
  backend: "redis" | "dev-file" | "unavailable";
}> {
  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    const raw = await redis.get<Partial<HrDocumentsManifest>>(MANIFEST_REDIS_KEY);
    if (!raw) {
      return { manifest: emptyManifest(), backend: "redis" };
    }
    const documents = Array.isArray(raw.documents)
      ? raw.documents.map((d) =>
          normalizeHrDocumentMeta(d as Partial<HrDocumentMeta>)
        )
      : [];
    return {
      manifest: {
        documents: sortDocuments(documents),
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
  manifest: HrDocumentsManifest
): Promise<"redis" | "dev-file" | "unavailable"> {
  const payload: HrDocumentsManifest = {
    documents: sortDocuments(manifest.documents),
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

export async function listHrDocuments(): Promise<{
  documents: HrDocumentMeta[];
  backend: "redis" | "dev-file" | "unavailable";
}> {
  const { manifest, backend } = await loadManifest();
  return { documents: manifest.documents, backend };
}

export async function getHrDocumentMeta(
  id: string
): Promise<HrDocumentMeta | null> {
  const { documents } = await listHrDocuments();
  return documents.find((d) => d.id === id) ?? null;
}

async function readDevFileBuffer(id: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(DEV_FILES_DIR, id));
  } catch {
    return null;
  }
}

async function writeDevFileBuffer(id: string, data: Buffer): Promise<void> {
  await fs.mkdir(DEV_FILES_DIR, { recursive: true });
  await fs.writeFile(path.join(DEV_FILES_DIR, id), data);
}

async function deleteDevFileBuffer(id: string): Promise<void> {
  try {
    await fs.unlink(path.join(DEV_FILES_DIR, id));
  } catch {
    /* ignore */
  }
}

export async function readHrDocumentBuffer(id: string): Promise<Buffer | null> {
  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    const encoded = await redis.get<string>(fileRedisKey(id));
    if (!encoded || typeof encoded !== "string") return null;
    return Buffer.from(encoded, "base64");
  }

  if (process.env.NODE_ENV === "development") {
    return readDevFileBuffer(id);
  }

  return null;
}

export async function saveHrDocument(input: {
  name: string;
  category: HrDocumentCategory;
  mimeType: string;
  data: Buffer;
  annualSalary?: number | null;
  salaryExtractStatus?: HrSalaryExtractStatus;
  salaryTextLength?: number;
}): Promise<{ meta: HrDocumentMeta; backend: "redis" | "dev-file" | "unavailable" }> {
  if (!isHrDocumentsStorageAvailable()) {
    return {
      meta: {
        id: "",
        name: input.name,
        category: input.category,
        mimeType: input.mimeType,
        size: input.data.length,
        uploadedAt: new Date().toISOString(),
      },
      backend: "unavailable",
    };
  }

  const id = randomUUID();
  const meta: HrDocumentMeta = {
    id,
    name: input.name,
    category: input.category,
    mimeType: input.mimeType || "application/octet-stream",
    size: input.data.length,
    uploadedAt: new Date().toISOString(),
    annualSalary: input.annualSalary ?? null,
    salaryExtractStatus: input.salaryExtractStatus,
    salaryTextLength: input.salaryTextLength,
  };

  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    await redis.set(fileRedisKey(id), input.data.toString("base64"));
    const { manifest } = await loadManifest();
    manifest.documents.push(meta);
    const backend = await saveManifest(manifest);
    return { meta, backend };
  }

  if (process.env.NODE_ENV === "development") {
    await writeDevFileBuffer(id, input.data);
    const { manifest } = await loadManifest();
    manifest.documents.push(meta);
    const backend = await saveManifest(manifest);
    return { meta, backend };
  }

  return { meta, backend: "unavailable" };
}

export async function deleteHrDocument(
  id: string
): Promise<"redis" | "dev-file" | "unavailable" | "not-found"> {
  const { manifest } = await loadManifest();
  const index = manifest.documents.findIndex((d) => d.id === id);
  if (index < 0) return "not-found";

  manifest.documents.splice(index, 1);

  if (isCloudStorageConfigured()) {
    const redis = getRedis();
    await redis.del(fileRedisKey(id));
    await saveManifest(manifest);
    return "redis";
  }

  if (process.env.NODE_ENV === "development") {
    await deleteDevFileBuffer(id);
    await saveManifest(manifest);
    return "dev-file";
  }

  return "unavailable";
}

export async function updateHrDocumentSalary(
  id: string,
  salary: Pick<
    HrDocumentMeta,
    "annualSalary" | "salaryExtractStatus" | "salaryTextLength"
  >
): Promise<"redis" | "dev-file" | "unavailable" | "not-found"> {
  const { manifest } = await loadManifest();
  const doc = manifest.documents.find((d) => d.id === id);
  if (!doc) return "not-found";

  doc.annualSalary = salary.annualSalary ?? null;
  doc.salaryExtractStatus = salary.salaryExtractStatus;
  doc.salaryTextLength = salary.salaryTextLength;

  return saveManifest(manifest);
}
