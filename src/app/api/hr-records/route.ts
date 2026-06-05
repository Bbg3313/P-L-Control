import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  createHrRecord,
  isHrRecordsStorageAvailable,
  listHrRecords,
} from "@/lib/hr-records-store";
import {
  isEmploymentStatus,
  type HrEmployeeRecordInput,
} from "@/lib/hr-records-types";
import {
  formatKoreanPhone,
  formatKoreanResidentId,
} from "@/lib/hr-records-utils";
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

function parseRecordInput(body: unknown): HrEmployeeRecordInput | string {
  if (!body || typeof body !== "object") return "잘못된 요청입니다.";

  const raw = body as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return "이름을 입력해 주세요.";

  const statusRaw =
    typeof raw.status === "string" ? raw.status.trim() : "";
  const status: HrEmployeeRecordInput["status"] = isEmploymentStatus(statusRaw)
    ? statusRaw
    : "재직";

  const text = (key: string) =>
    typeof raw[key] === "string" ? String(raw[key]).trim() : "";

  return {
    name,
    status,
    department: text("department"),
    position: text("position"),
    acquiredDate: text("acquiredDate"),
    lostDate: text("lostDate"),
    residentId: formatKoreanResidentId(text("residentId")),
    bank: text("bank"),
    accountNumber: text("accountNumber"),
    phone: formatKoreanPhone(text("phone")),
    address: text("address"),
  };
}

export async function GET() {
  const authError = checkAuth();
  if (authError) return authError;

  const { records, backend } = await listHrRecords();
  const storageConfigured =
    isHrRecordsStorageAvailable() &&
    (isCloudStorageConfigured() || backend === "dev-file");

  return NextResponse.json({
    records,
    _meta: { backend, storageConfigured },
  });
}

export async function POST(request: Request) {
  const authError = checkAuth();
  if (authError) return authError;

  if (!isHrRecordsStorageAvailable()) {
    return NextResponse.json(
      {
        error:
          "서버 저장소가 연결되지 않았습니다. Vercel에서 Upstash Redis를 연결해 주세요.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = parseRecordInput(body);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  const { record, backend } = await createHrRecord(parsed);
  if (backend === "unavailable") {
    return NextResponse.json(
      { error: "저장소에 기록을 저장하지 못했습니다." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, record, backend });
}
