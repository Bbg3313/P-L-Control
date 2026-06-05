import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  isHrLeaveStorageAvailable,
  listHrLeaveUsages,
  upsertHrLeaveEntries,
} from "@/lib/hr-leave-store";
import {
  type HrLeaveEntry,
  leaveDaysForType,
  sumLeaveEntryDays,
} from "@/lib/hr-leave-types";
import { listHrRecords } from "@/lib/hr-records-store";
import { calcStatutoryAnnualLeave } from "@/lib/annual-leave-law";
import { isCloudStorageConfigured } from "@/lib/workspace-store";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

function checkAuth() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!isAuthenticated(token)) return unauthorized();
  return null;
}

function parseLeaveEntries(raw: unknown): HrLeaveEntry[] | null {
  if (!Array.isArray(raw)) return null;

  const entries: HrLeaveEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const date = typeof row.date === "string" ? row.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

    const type =
      row.type === "연차" ? "연차" : row.type === "반차" ? "반차" : null;
    if (!type) return null;

    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : randomUUID();

    entries.push({
      id,
      date,
      type,
      days: leaveDaysForType(type),
    });
  }

  return entries;
}

export async function GET() {
  const authError = checkAuth();
  if (authError) return authError;

  const [{ records }, usages] = await Promise.all([
    listHrRecords(),
    listHrLeaveUsages(),
  ]);

  const usageMap = new Map(usages.map((u) => [u.employeeId, u.entries]));

  const employees = records
    .filter((r) => r.status === "재직" || r.status === "휴직")
    .map((record) => {
      const entitlement = record.acquiredDate
        ? calcStatutoryAnnualLeave(record.acquiredDate)
        : null;
      const granted = entitlement?.days ?? 0;
      const entries = usageMap.get(record.id) ?? [];
      const used = sumLeaveEntryDays(entries);
      return {
        id: record.id,
        name: record.name,
        department: record.department,
        position: record.position,
        status: record.status,
        acquiredDate: record.acquiredDate,
        grantedDays: granted,
        usedDays: used,
        remainingDays: Math.max(0, granted - used),
        entries: [...entries].sort((a, b) => b.date.localeCompare(a.date)),
        phase: entitlement?.phase ?? null,
        tenureMonths: entitlement?.tenureMonths ?? 0,
        tenureYears: entitlement?.tenureYears ?? 0,
        ruleLabel: entitlement?.ruleLabel ?? "입사일을 등록해 주세요.",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return NextResponse.json({
    employees,
    _meta: {
      storageConfigured:
        isHrLeaveStorageAvailable() && isCloudStorageConfigured(),
    },
  });
}

export async function PUT(request: Request) {
  const authError = checkAuth();
  if (authError) return authError;

  if (!isHrLeaveStorageAvailable()) {
    return NextResponse.json(
      { error: "저장소가 연결되지 않았습니다." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const employeeId =
    typeof raw.employeeId === "string" ? raw.employeeId.trim() : "";
  const entries = parseLeaveEntries(raw.entries);

  if (!employeeId) {
    return NextResponse.json({ error: "직원 ID가 없습니다." }, { status: 400 });
  }
  if (entries === null) {
    return NextResponse.json(
      { error: "연차 사용 내역을 확인해 주세요." },
      { status: 400 }
    );
  }

  const backend = await upsertHrLeaveEntries(employeeId, entries);
  if (backend === "unavailable") {
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    employeeId,
    usedDays: sumLeaveEntryDays(entries),
    backend,
  });
}
