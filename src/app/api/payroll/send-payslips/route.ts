import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthenticated } from "@/lib/auth";
import {
  createDefaultPersonnel,
  FIXED_PERSONNEL_NAMES,
  isOverseasTeam,
  type PersonnelEntry,
} from "@/lib/personnel";
import {
  buildPayrollLedger,
  type PayrollCompanyId,
} from "@/lib/payroll-ledger";
import { buildPayslipHtml } from "@/lib/payroll-payslip-export";
import {
  isResendConfigured,
  isValidEmail,
  sendPayslipEmail,
} from "@/lib/payroll-email";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

function checkAuth() {
  const token = cookies().get(AUTH_COOKIE_NAME)?.value;
  if (!isAuthenticated(token)) return unauthorized();
  return null;
}

type SendBody = {
  yearMonth?: string;
  companyId?: PayrollCompanyId;
  emails?: Record<string, string>;
  performancePayOverrides?: Record<string, number>;
  noteOverrides?: Record<string, string>;
  personnel?: PersonnelEntry[];
  hrByName?: Record<string, { department: string; position: string }>;
};

export type PayslipSendResultItem = {
  name: string;
  email: string | null;
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

function normalizePersonnel(raw: unknown): PersonnelEntry[] {
  const defaults = createDefaultPersonnel();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  const byName = new Map<string, PersonnelEntry>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<PersonnelEntry>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name || isOverseasTeam(name)) continue;
    if (!(FIXED_PERSONNEL_NAMES as readonly string[]).includes(name)) continue;
    byName.set(name, {
      id: typeof row.id === "string" && row.id ? row.id : name,
      name,
      inputMode: row.inputMode === "salary" ? "salary" : "direct",
      directMonthlyAmount: Number(row.directMonthlyAmount) || 0,
      salaryAmount: Number(row.salaryAmount) || 0,
      salaryBasis: row.salaryBasis === "monthly" ? "monthly" : "annual",
      exchangeRateToKrw: Number(row.exchangeRateToKrw) || 0,
      exchangeRateDate:
        typeof row.exchangeRateDate === "string"
          ? row.exchangeRateDate
          : new Date().toISOString().slice(0, 10),
    });
  }

  return defaults.map((d) => byName.get(d.name) ?? d);
}

export async function POST(request: Request) {
  const authError = checkAuth();
  if (authError) return authError;

  if (!isResendConfigured()) {
    return NextResponse.json(
      {
        error:
          "RESEND_API_KEY가 없습니다. Resend에서 API 키를 발급해 Vercel/.env.local에 등록한 뒤 재배포하세요.",
      },
      { status: 503 }
    );
  }

  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const yearMonth =
    typeof body.yearMonth === "string" ? body.yearMonth.trim() : "";
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json(
      { error: "yearMonth(YYYY-MM)가 필요합니다." },
      { status: 400 }
    );
  }

  const companyId: PayrollCompanyId =
    body.companyId === "goldfender" ? "goldfender" : "bluebridge";

  const emailsIn =
    body.emails && typeof body.emails === "object" ? body.emails : {};
  const performancePayOverrides =
    body.performancePayOverrides &&
    typeof body.performancePayOverrides === "object"
      ? body.performancePayOverrides
      : {};
  const noteOverrides =
    body.noteOverrides && typeof body.noteOverrides === "object"
      ? body.noteOverrides
      : {};
  const hrByName =
    body.hrByName && typeof body.hrByName === "object" ? body.hrByName : {};

  const personnel = normalizePersonnel(body.personnel);
  const ledger = buildPayrollLedger(
    yearMonth,
    personnel,
    hrByName,
    companyId,
    performancePayOverrides,
    noteOverrides
  );

  const results: PayslipSendResultItem[] = [];

  for (let i = 0; i < ledger.domestic.length; i += 1) {
    const row = ledger.domestic[i];
    const emailRaw = emailsIn[row.name];
    const email =
      typeof emailRaw === "string" ? emailRaw.trim() : "";

    if (!email) {
      results.push({
        name: row.name,
        email: null,
        ok: false,
        skipped: true,
        error: "이메일이 등록되지 않았습니다.",
      });
      continue;
    }

    if (!isValidEmail(email)) {
      results.push({
        name: row.name,
        email,
        ok: false,
        error: "이메일 형식이 올바르지 않습니다.",
      });
      continue;
    }

    const html = buildPayslipHtml(ledger, row, i + 1);
    const sent = await sendPayslipEmail({
      to: email,
      employeeName: row.name,
      yearMonth,
      html,
    });

    if (sent.ok) {
      results.push({ name: row.name, email, ok: true });
    } else {
      results.push({
        name: row.name,
        email,
        ok: false,
        error: sent.error,
      });
    }
  }

  const sentCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok && !r.skipped).length;
  const skipCount = results.filter((r) => r.skipped).length;

  return NextResponse.json({
    yearMonth,
    companyId,
    sentCount,
    failCount,
    skipCount,
    results,
  });
}
