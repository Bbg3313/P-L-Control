import type { EmploymentStatus } from "@/lib/hr-records-types";

function parseLocalDate(value: string): Date | null {
  const [y, m, d] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function calcTenureMonths(start: Date, end: Date): number | null {
  if (end < start) return null;

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  if (end.getDate() < start.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

function formatDuration(years: number, months: number): string {
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}년`);
  if (months > 0) parts.push(`${months}개월`);
  if (parts.length === 0) return "1개월 미만";
  return parts.join(" ");
}

/** 입사일 기준 재직 기간 문구 (예: 2년 3개월 재직중) */
export function formatEmploymentTenure(
  acquiredDate: string,
  lostDate: string,
  status: EmploymentStatus,
  referenceDate: Date = new Date()
): string | null {
  const start = parseLocalDate(acquiredDate);
  if (!start) return null;

  const end =
    status === "퇴직" && lostDate
      ? (parseLocalDate(lostDate) ?? referenceDate)
      : referenceDate;

  const totalMonths = calcTenureMonths(start, end);
  if (totalMonths === null) return null;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const duration = formatDuration(years, months);

  if (status === "퇴직") return `총 ${duration} 재직`;
  if (status === "휴직") return `${duration} (휴직)`;
  return `${duration} 재직중`;
}

/** 숫자만 입력해도 한국 전화번호 형식으로 하이픈 삽입 */
export function formatKoreanPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("02")) {
    const body = digits.slice(2);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `02-${body}`;
    if (digits.length <= 9) {
      return `02-${body.slice(0, body.length - 4)}-${body.slice(-4)}`;
    }
    return `02-${body.slice(0, 4)}-${body.slice(4, 8)}`;
  }

  if (digits.startsWith("01")) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  if (digits.startsWith("0")) {
    const area = digits.slice(0, 3);
    const body = digits.slice(3);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${area}-${body}`;
    return `${area}-${body.slice(0, body.length - 4)}-${body.slice(-4)}`;
  }

  if (digits.length <= 4) return digits;
  if (digits.length <= 8) {
    return `${digits.slice(0, digits.length - 4)}-${digits.slice(-4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
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
