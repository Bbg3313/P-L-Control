import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  isHrLeaveStorageAvailable,
  listHrLeaveUsages,
  upsertHrLeaveUsage,
} from "@/lib/hr-leave-store";
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

export async function GET() {
  const authError = checkAuth();
  if (authError) return authError;

  const [{ records }, usages] = await Promise.all([
    listHrRecords(),
    listHrLeaveUsages(),
  ]);

  const usageMap = new Map(usages.map((u) => [u.employeeId, u.usedDays]));

  const employees = records
    .filter((r) => r.status === "재직" || r.status === "휴직")
    .map((record) => {
      const entitlement = record.acquiredDate
        ? calcStatutoryAnnualLeave(record.acquiredDate)
        : null;
      const granted = entitlement?.days ?? 0;
      const used = usageMap.get(record.id) ?? 0;
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
  const usedDays =
    typeof raw.usedDays === "number" && raw.usedDays >= 0
      ? Math.floor(raw.usedDays)
      : Number.NaN;

  if (!employeeId) {
    return NextResponse.json({ error: "직원 ID가 없습니다." }, { status: 400 });
  }
  if (!Number.isFinite(usedDays)) {
    return NextResponse.json({ error: "사용 일수를 확인해 주세요." }, { status: 400 });
  }

  const backend = await upsertHrLeaveUsage(employeeId, usedDays);
  if (backend === "unavailable") {
    return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, employeeId, usedDays, backend });
}
