import type { WorkspaceSnapshot } from "@/lib/workspace-types";
import type { PersonnelEntry } from "@/lib/personnel";
import type { FinancialRecord } from "@/lib/types";

export type DataSyncMode = "cloud" | "local-only";

export interface WorkspaceApiResponse extends WorkspaceSnapshot {
  _meta?: {
    backend: string;
    cloudConfigured: boolean;
    hasData: boolean;
  };
}

export async function fetchWorkspaceFromApi(): Promise<{
  snapshot: WorkspaceSnapshot;
  mode: DataSyncMode;
  cloudConfigured: boolean;
} | null> {
  try {
    const res = await fetch("/api/workspace", { cache: "no-store" });
    if (!res.ok) return null;

    const data = (await res.json()) as WorkspaceApiResponse;
    const { _meta, ...snapshot } = data;

    return {
      snapshot: {
        records: snapshot.records ?? [],
        personnel: snapshot.personnel ?? [],
        reportingMonth: snapshot.reportingMonth ?? null,
        updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
      },
      mode: _meta?.cloudConfigured ? "cloud" : "local-only",
      cloudConfigured: Boolean(_meta?.cloudConfigured),
    };
  } catch {
    return null;
  }
}

export async function saveWorkspaceToApi(payload: {
  records: FinancialRecord[];
  personnel: PersonnelEntry[];
  reportingMonth: string;
}): Promise<{ ok: boolean; cloudConfigured: boolean }> {
  try {
    const res = await fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: payload.records,
        personnel: payload.personnel,
        reportingMonth: payload.reportingMonth,
      }),
    });

    if (res.status === 503) {
      return { ok: false, cloudConfigured: false };
    }

    return { ok: res.ok, cloudConfigured: res.ok };
  } catch {
    return { ok: false, cloudConfigured: false };
  }
}
