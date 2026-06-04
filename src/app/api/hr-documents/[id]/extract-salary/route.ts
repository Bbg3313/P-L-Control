import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import { extractAnnualSalaryFromContract } from "@/lib/hr-contract-salary";
import {
  getHrDocumentMeta,
  readHrDocumentBuffer,
  updateHrDocumentSalary,
} from "@/lib/hr-documents-store";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

function checkAuth() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!isAuthenticated(token)) return unauthorized();
  return null;
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const authError = checkAuth();
  if (authError) return authError;

  const meta = await getHrDocumentMeta(params.id);
  if (!meta) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  if (meta.category !== "근로계약서") {
    return NextResponse.json(
      { error: "근로계약서만 연봉을 추출할 수 있습니다." },
      { status: 400 }
    );
  }

  const buffer = await readHrDocumentBuffer(params.id);
  if (!buffer) {
    return NextResponse.json(
      { error: "파일 내용을 불러오지 못했습니다." },
      { status: 404 }
    );
  }

  const extraction = await extractAnnualSalaryFromContract({
    buffer,
    mimeType: meta.mimeType,
    filename: meta.name,
    category: meta.category,
  });

  const result = await updateHrDocumentSalary(params.id, {
    annualSalary: extraction.annualSalary,
    salaryExtractStatus: extraction.status,
    salaryTextLength: extraction.textLength,
  });

  if (result === "not-found") {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }
  if (result === "unavailable") {
    return NextResponse.json(
      { error: "저장소에 반영하지 못했습니다." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    annualSalary: extraction.annualSalary,
    status: extraction.status,
    textLength: extraction.textLength ?? 0,
  });
}
