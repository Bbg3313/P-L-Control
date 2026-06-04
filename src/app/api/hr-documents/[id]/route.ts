import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  deleteHrDocument,
  getHrDocumentMeta,
  readHrDocumentBuffer,
} from "@/lib/hr-documents-store";

function unauthorized() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

function checkAuth() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!isAuthenticated(token)) return unauthorized();
  return null;
}

function encodeFilename(filename: string): string {
  return encodeURIComponent(filename).replace(/['()]/g, escape);
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const authError = checkAuth();
  if (authError) return authError;

  const meta = await getHrDocumentMeta(params.id);
  if (!meta) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const buffer = await readHrDocumentBuffer(params.id);
  if (!buffer) {
    return NextResponse.json(
      { error: "파일 내용을 불러오지 못했습니다." },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": meta.mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeFilename(meta.name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const authError = checkAuth();
  if (authError) return authError;

  const result = await deleteHrDocument(params.id);
  if (result === "not-found") {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }
  if (result === "unavailable") {
    return NextResponse.json(
      { error: "저장소에서 삭제하지 못했습니다." },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, backend: result });
}
