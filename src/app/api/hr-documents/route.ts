import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  HR_DOCUMENT_MAX_BYTES,
  isHrDocumentsStorageAvailable,
  listHrDocuments,
  saveHrDocument,
} from "@/lib/hr-documents-store";
import { normalizeHrDocumentCategory } from "@/lib/hr-documents-types";
import { extractAnnualSalaryFromContract } from "@/lib/hr-contract-salary";
import { validateHrUploadFile } from "@/lib/hr-file-utils";
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

  const { documents, backend } = await listHrDocuments();
  const storageConfigured =
    isHrDocumentsStorageAvailable() &&
    (isCloudStorageConfigured() || backend === "dev-file");

  return NextResponse.json({
    documents,
    _meta: {
      backend,
      storageConfigured,
      maxBytes: HR_DOCUMENT_MAX_BYTES,
    },
  });
}

export async function POST(request: Request) {
  const authError = checkAuth();
  if (authError) return authError;

  if (!isHrDocumentsStorageAvailable()) {
    return NextResponse.json(
      {
        error:
          "서버 저장소가 연결되지 않았습니다. Vercel에서 Upstash Redis를 연결해 주세요.",
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  const validationError = validateHrUploadFile(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const category = normalizeHrDocumentCategory(
    String(formData.get("category") ?? "")
  );

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > HR_DOCUMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: "파일 크기가 제한을 초과했습니다." },
      { status: 400 }
    );
  }

  const salaryExtraction = await extractAnnualSalaryFromContract({
    buffer,
    mimeType: file.type || "application/octet-stream",
    filename: file.name,
    category,
  });

  const { meta, backend } = await saveHrDocument({
    name: file.name,
    category,
    mimeType: file.type || "application/octet-stream",
    data: buffer,
    annualSalary: salaryExtraction.annualSalary,
    salaryExtractStatus: salaryExtraction.status,
    salaryTextLength: salaryExtraction.textLength,
  });

  if (backend === "unavailable") {
    return NextResponse.json(
      { error: "저장소에 파일을 저장하지 못했습니다." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, document: meta, backend });
}
