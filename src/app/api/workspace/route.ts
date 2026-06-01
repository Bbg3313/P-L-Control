import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  createEmptyWorkspace,
  hasWorkspaceData,
  isCloudStorageConfigured,
  loadWorkspaceFromStore,
  saveWorkspaceToStore,
} from "@/lib/workspace-store";
import type { WorkspaceSnapshot } from "@/lib/workspace-types";

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

  const { snapshot, backend } = await loadWorkspaceFromStore();

  const cloudConfigured =
    isCloudStorageConfigured() ||
    (process.env.NODE_ENV === "development" && backend === "dev-file");

  return NextResponse.json({
    ...snapshot,
    _meta: {
      backend,
      cloudConfigured,
      hasData: hasWorkspaceData(snapshot),
    },
  });
}

export async function PUT(request: Request) {
  const authError = checkAuth();
  if (authError) return authError;

  let body: Partial<WorkspaceSnapshot>;
  try {
    body = (await request.json()) as Partial<WorkspaceSnapshot>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const snapshot: WorkspaceSnapshot = {
    records: Array.isArray(body.records) ? body.records : [],
    personnel: Array.isArray(body.personnel) ? body.personnel : createEmptyWorkspace().personnel,
    reportingMonth: body.reportingMonth ?? null,
    updatedAt: new Date().toISOString(),
  };

  const backend = await saveWorkspaceToStore(snapshot);
  if (backend === "unavailable") {
    return NextResponse.json(
      {
        error:
          "서버 저장소가 연결되지 않았습니다. Vercel에서 Upstash Redis를 연결해 주세요.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    backend,
    updatedAt: snapshot.updatedAt,
  });
}
