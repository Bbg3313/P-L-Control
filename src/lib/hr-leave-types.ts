export interface HrLeaveUsage {
  employeeId: string;
  /** 사용한 연차(일) */
  usedDays: number;
  updatedAt: string;
}

export interface HrLeaveManifest {
  usages: HrLeaveUsage[];
  updatedAt: string;
}

export function normalizeHrLeaveUsage(
  raw: Partial<HrLeaveUsage>
): HrLeaveUsage {
  return {
    employeeId: String(raw.employeeId ?? ""),
    usedDays:
      typeof raw.usedDays === "number" && raw.usedDays >= 0
        ? Math.floor(raw.usedDays)
        : 0,
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}
