import { randomUUID } from "crypto";

export type LeaveEntryType = "연차" | "반차";

export interface HrLeaveEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: LeaveEntryType;
  days: 0.5 | 1;
}

export interface HrLeaveUsage {
  employeeId: string;
  entries: HrLeaveEntry[];
  updatedAt: string;
}

export interface HrLeaveManifest {
  usages: HrLeaveUsage[];
  updatedAt: string;
}

export function leaveDaysForType(type: LeaveEntryType): 0.5 | 1 {
  return type === "반차" ? 0.5 : 1;
}

export function sumLeaveEntryDays(entries: HrLeaveEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.days, 0);
}

function normalizeLeaveEntry(raw: Partial<HrLeaveEntry>): HrLeaveEntry | null {
  const date = String(raw.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const type: LeaveEntryType | null =
    raw.type === "반차" ? "반차" : raw.type === "연차" ? "연차" : null;
  if (!type) return null;

  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : randomUUID(),
    date,
    type,
    days: leaveDaysForType(type),
  };
}

export function normalizeHrLeaveUsage(
  raw: Partial<HrLeaveUsage> & { usedDays?: number }
): HrLeaveUsage {
  const entries = Array.isArray(raw.entries)
    ? raw.entries
        .map((entry) => normalizeLeaveEntry(entry))
        .filter((entry): entry is HrLeaveEntry => entry !== null)
    : [];

  return {
    employeeId: String(raw.employeeId ?? ""),
    entries,
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}
