import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  hasCashflowData,
  isCashflowStorageAvailable,
  loadCashflowFromStore,
  normalizeCashflowSnapshot,
  saveCashflowToStore,
} from "@/lib/cashflow-store";
import type { CashflowSnapshot } from "@/lib/cashflow-types";
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

  const { snapshot, backend } = await loadCashflowFromStore();
  const storageConfigured =
    isCashflowStorageAvailable() &&
    (isCloudStorageConfigured() || backend === "dev-file");

  return NextResponse.json({
    ...snapshot,
    _meta: {
      backend,
      storageConfigured,
      hasData: hasCashflowData(snapshot),
    },
  });
}

export async function PUT(request: Request) {
  const authError = checkAuth();
  if (authError) return authError;

  let body: Partial<CashflowSnapshot>;
  try {
    body = (await request.json()) as Partial<CashflowSnapshot>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const snapshot = normalizeCashflowSnapshot({
    hospitals: body.hospitals ?? [],
    expenseTemplates: body.expenseTemplates ?? [],
    months: body.months ?? {},
    seedVersion: body.seedVersion,
  });

  const backend = await saveCashflowToStore(snapshot);
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
