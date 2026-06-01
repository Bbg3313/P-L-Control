import type { FinancialRecord } from "@/lib/types";
import type { PersonnelEntry } from "@/lib/personnel";

export interface WorkspaceSnapshot {
  records: FinancialRecord[];
  personnel: PersonnelEntry[];
  reportingMonth: string | null;
  updatedAt: string;
}

export const WORKSPACE_KV_KEY = "pl-control-workspace";
