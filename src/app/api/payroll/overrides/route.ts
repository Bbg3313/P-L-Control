import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  hasOverrideData,
  isPayrollOverridesStorageAvailable,
  loadPayrollOverridesFromStore,
  normalizePayrollOverridesSnapshot,
  savePayrollOverridesToStore,
} from "@/lib/payroll-overrides-store";
import type { PayrollOverridesSnapshot } from "@/lib/payroll-ledger-store";
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

  const { snapshot, backend } = await loadPayrollOverridesFromStore();
  const storageConfigured =
    isPayrollOverridesStorageAvailable() &&
    (isCloudStorageConfigured() || backend === "dev-file");

  return NextResponse.json({
    ...snapshot,
    _meta: {
      backend,
      storageConfigured,
      hasData: hasOverrideData(snapshot),
    },
  });
}

export async function PUT(request: Request) {
  const authError = checkAuth();
  if (authError) return authError;

  let body: Partial<PayrollOverridesSnapshot>;
  try {
    body = (await request.json()) as Partial<PayrollOverridesSnapshot>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const snapshot = normalizePayrollOverridesSnapshot({
    performancePay: body.performancePay ?? {},
    notes: body.notes ?? {},
  });

  const backend = await savePayrollOverridesToStore(snapshot);
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
