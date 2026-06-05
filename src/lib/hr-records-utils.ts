import type { EmploymentStatus } from "@/lib/hr-records-types";

export function maskResidentId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 7) return trimmed;
  const front = digits.slice(0, 6);
  const dash = trimmed.includes("-") ? "-" : "-";
  const gender = digits[6];
  return `${front}${dash}${gender}******`;
}

export function formatHrRecordDate(value: string): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${y}. ${m}. ${d}.`;
}

export function statusBadgeClass(status: EmploymentStatus): string {
  switch (status) {
    case "재직":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "휴직":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    case "퇴직":
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}
