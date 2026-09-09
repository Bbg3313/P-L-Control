/** 직원 급여명세서 수신 이메일 — 이름 → 이메일 */

export const PERSONNEL_EMAILS_STORAGE_KEY = "pl-control-personnel-emails-v1";
export const PERSONNEL_EMAIL_ROSTER_STORAGE_KEY =
  "pl-control-personnel-email-roster-v1";

export type PersonnelEmails = Record<string, string>;

export type PersonnelEmailEntry = {
  name: string;
  email: string;
};

type PersonnelEmailRoster = {
  entries: PersonnelEmailEntry[];
};

/** 기본 등록 이메일 (최초 시드·레거시 병합용) */
export const DEFAULT_PERSONNEL_EMAILS: PersonnelEmails = {
  안효재: "hyopus@bluebridge-global.com",
  성수린: "ssflsl@naver.com",
  정수민: "jsm070405@naver.com",
  니키: "nics.patcharaporn@gmail.com",
  김소연: "kimlinkhan@naver.com",
};

function readLegacyEmails(): PersonnelEmails {
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
        out[name.trim()] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

function normalizeEntry(raw: Partial<PersonnelEmailEntry>): PersonnelEmailEntry | null {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  if (!name) return null;
  return { name, email };
}

function seedEntriesFromDefaults(): PersonnelEmailEntry[] {
  const merged: PersonnelEmails = {
    ...DEFAULT_PERSONNEL_EMAILS,
    ...readLegacyEmails(),
  };
  const names = Object.keys(merged);
  names.sort((a, b) => a.localeCompare(b, "ko"));
  return names.map((name) => ({
    name,
    email: merged[name] ?? "",
  }));
}

function readRoster(): PersonnelEmailRoster | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PERSONNEL_EMAIL_ROSTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const entriesRaw = (parsed as { entries?: unknown }).entries;
    if (!Array.isArray(entriesRaw)) return null;
    const entries = entriesRaw
      .map((item) =>
        item && typeof item === "object"
          ? normalizeEntry(item as Partial<PersonnelEmailEntry>)
          : null
      )
      .filter((e): e is PersonnelEmailEntry => Boolean(e));
    return { entries };
  } catch {
    return null;
  }
}

function writeRoster(entries: PersonnelEmailEntry[]): void {
  if (typeof window === "undefined") return;
  const cleaned = entries
    .map((e) => normalizeEntry(e))
    .filter((e): e is PersonnelEmailEntry => Boolean(e));
  const roster: PersonnelEmailRoster = { entries: cleaned };
  localStorage.setItem(
    PERSONNEL_EMAIL_ROSTER_STORAGE_KEY,
    JSON.stringify(roster)
  );

  // 급여대장·설정 호환용 레거시 맵도 같이 갱신
  const map: PersonnelEmails = {};
  for (const entry of cleaned) {
    if (entry.email) map[entry.name] = entry.email;
  }
  localStorage.setItem(PERSONNEL_EMAILS_STORAGE_KEY, JSON.stringify(map));
}

/** 발송 대상 명단 (추가·삭제 반영). 최초에는 기본 등록 인원으로 시드 */
export function loadPersonnelEmailEntries(): PersonnelEmailEntry[] {
  const roster = readRoster();
  if (roster) return roster.entries.map((e) => ({ ...e }));
  return seedEntriesFromDefaults();
}

export function savePersonnelEmailEntries(entries: PersonnelEmailEntry[]): void {
  writeRoster(entries);
}

export function loadPersonnelEmails(): PersonnelEmails {
  const entries = loadPersonnelEmailEntries();
  const out: PersonnelEmails = {};
  for (const entry of entries) {
    if (entry.email) out[entry.name] = entry.email;
  }
  // 로스터가 아직 없으면 기본값 보장
  if (!readRoster()) {
    return { ...DEFAULT_PERSONNEL_EMAILS, ...out };
  }
  return out;
}

export function savePersonnelEmails(data: PersonnelEmails): void {
  const existing = loadPersonnelEmailEntries();
  const byName = new Map(existing.map((e) => [e.name, e]));
  for (const [name, email] of Object.entries(data)) {
    const trimmedName = name.trim();
    if (!trimmedName) continue;
    const trimmedEmail = email.trim();
    const prev = byName.get(trimmedName);
    if (prev) {
      byName.set(trimmedName, { name: trimmedName, email: trimmedEmail });
    } else if (trimmedEmail) {
      byName.set(trimmedName, { name: trimmedName, email: trimmedEmail });
    }
  }
  writeRoster(Array.from(byName.values()));
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

export function upsertPersonnelEmailEntry(
  entries: PersonnelEmailEntry[],
  name: string,
  email: string
): PersonnelEmailEntry[] {
  const trimmedName = name.trim();
  if (!trimmedName) return entries;
  const trimmedEmail = email.trim();
  const next = entries.map((e) => ({ ...e }));
  const idx = next.findIndex((e) => e.name === trimmedName);
  if (idx >= 0) {
    next[idx] = { name: trimmedName, email: trimmedEmail };
    return next;
  }
  return [...next, { name: trimmedName, email: trimmedEmail }];
}

export function removePersonnelEmailEntry(
  entries: PersonnelEmailEntry[],
  name: string
): PersonnelEmailEntry[] {
  return entries.filter((e) => e.name !== name);
}

export function updatePersonnelEmailEntryEmail(
  entries: PersonnelEmailEntry[],
  name: string,
  email: string
): PersonnelEmailEntry[] {
  return entries.map((e) =>
    e.name === name ? { ...e, email: email.trim() } : e
  );
}
