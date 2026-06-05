export const EMPLOYMENT_STATUSES = ["재직", "퇴직", "휴직"] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export interface HrEmployeeRecord {
  id: string;
  /** 소속 */
  department: string;
  /** 재직 상태 */
  status: EmploymentStatus;
  /** 직위 */
  position: string;
  /** 이름 */
  name: string;
  /** 입사일자 (YYYY-MM-DD) */
  acquiredDate: string;
  /** 상실일자 (YYYY-MM-DD) */
  lostDate: string;
  /** 주민등록번호 */
  residentId: string;
  /** 은행 */
  bank: string;
  /** 계좌번호 */
  accountNumber: string;
  /** 연락처 */
  phone: string;
  /** 주소 */
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface HrRecordsManifest {
  records: HrEmployeeRecord[];
  updatedAt: string;
}

export interface HrEmployeeRecordInput {
  department: string;
  status: EmploymentStatus;
  position: string;
  name: string;
  acquiredDate: string;
  lostDate: string;
  residentId: string;
  bank: string;
  accountNumber: string;
  phone: string;
  address: string;
}

export function isEmploymentStatus(value: string): value is EmploymentStatus {
  return (EMPLOYMENT_STATUSES as readonly string[]).includes(value);
}

export function normalizeEmploymentStatus(value: unknown): EmploymentStatus {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return isEmploymentStatus(trimmed) ? trimmed : "재직";
}

function normalizeDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeHrEmployeeRecord(
  raw: Partial<HrEmployeeRecord> & Record<string, unknown>
): HrEmployeeRecord {
  const now = new Date().toISOString();
  return {
    id: String(raw.id ?? ""),
    department: normalizeText(raw.department),
    status: normalizeEmploymentStatus(raw.status),
    position: normalizeText(raw.position),
    name: normalizeText(raw.name),
    acquiredDate: normalizeDate(raw.acquiredDate),
    lostDate: normalizeDate(raw.lostDate),
    residentId: normalizeText(raw.residentId),
    bank: normalizeText(raw.bank),
    accountNumber: normalizeText(raw.accountNumber),
    phone: normalizeText(raw.phone),
    address: normalizeText(raw.address),
    createdAt: String(raw.createdAt ?? now),
    updatedAt: String(raw.updatedAt ?? now),
  };
}

export function createEmptyHrEmployeeInput(): HrEmployeeRecordInput {
  return {
    department: "",
    status: "재직",
    position: "",
    name: "",
    acquiredDate: "",
    lostDate: "",
    residentId: "",
    bank: "",
    accountNumber: "",
    phone: "",
    address: "",
  };
}
