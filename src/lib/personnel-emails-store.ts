/** 직원 급여명세서 수신 이메일 — 이름 → 이메일 */

export const PERSONNEL_EMAILS_STORAGE_KEY = "pl-control-personnel-emails-v1";

export type PersonnelEmails = Record<string, string>;

/** 기본 등록 이메일 (로컬 저장이 비어 있거나 키 없을 때 사용) */
export const DEFAULT_PERSONNEL_EMAILS: PersonnelEmails = {
  안효재: "hyopus@bluebridge-global.com",
  성수린: "ssflsl@naver.com",
  정수민: "jsm070405@naver.com",
  니키: "nics.patcharaporn@gmail.com",
  김소연: "kimlinkhan@naver.com",
};

function readJsonRecord(): PersonnelEmails {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PERSONNEL_EMAILS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: PersonnelEmails = {};
    for (const [name, value] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (typeof value === "string" && value.trim()) {
        out[name] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function loadPersonnelEmails(): PersonnelEmails {
  const stored = readJsonRecord();
  return { ...DEFAULT_PERSONNEL_EMAILS, ...stored };
}

export function savePersonnelEmails(data: PersonnelEmails): void {
  if (typeof window === "undefined") return;
  const cleaned: PersonnelEmails = {};
  for (const [name, value] of Object.entries(data)) {
    const email = value.trim();
    if (email) cleaned[name] = email;
  }
  localStorage.setItem(PERSONNEL_EMAILS_STORAGE_KEY, JSON.stringify(cleaned));
}

export function setPersonnelEmail(
  data: PersonnelEmails,
  name: string,
  email: string | null
): PersonnelEmails {
  const next = { ...data };
  const trimmed = email?.trim() ?? "";
  if (!trimmed) {
    delete next[name];
  } else {
    next[name] = trimmed;
  }
  return next;
}
