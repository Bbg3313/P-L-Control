import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  deleteHrRecord,
  getHrRecord,
  updateHrRecord,
} from "@/lib/hr-records-store";
import {
  isEmploymentStatus,
  type HrEmployeeRecordInput,
} from "@/lib/hr-records-types";
import { formatKoreanPhone } from "@/lib/hr-records-utils";

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
    residentId: text("residentId"),
    bank: text("bank"),
    accountNumber: text("accountNumber"),
    phone: formatKoreanPhone(text("phone")),
    address: text("address"),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const authError = checkAuth();
  if (authError) return authError;

  const record = await getHrRecord(params.id);
  if (!record) {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ record });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authError = checkAuth();
  if (authError) return authError;

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

  const result = await updateHrRecord(params.id, parsed);
  if (result === "not-found") {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }
  if (result === "unavailable") {
    return NextResponse.json(
      { error: "저장소에 반영하지 못했습니다." },
      { status: 503 }
    );
  }

  const record = await getHrRecord(params.id);
  return NextResponse.json({ ok: true, record, backend: result });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const authError = checkAuth();
  if (authError) return authError;

  const result = await deleteHrRecord(params.id);
  if (result === "not-found") {
    return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  }
  if (result === "unavailable") {
    return NextResponse.json(
      { error: "저장소에서 삭제하지 못했습니다." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, backend: result });
}
