import { Resend } from "resend";
import {
  DEFAULT_PAYROLL_FROM_EMAIL,
  DEFAULT_PAYROLL_FROM_NAME,
} from "@/lib/payroll-email-constants";

export {
  DEFAULT_PAYROLL_FROM_EMAIL,
  DEFAULT_PAYROLL_FROM_NAME,
} from "@/lib/payroll-email-constants";

export function getPayrollFromEmail(): string {
  return (
    process.env.PAYROLL_FROM_EMAIL?.trim() || DEFAULT_PAYROLL_FROM_EMAIL
  );
}

export function getPayrollFromName(): string {
  return process.env.PAYROLL_FROM_NAME?.trim() || DEFAULT_PAYROLL_FROM_NAME;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type SendPayslipEmailInput = {
  to: string;
  employeeName: string;
  yearMonth: string;
  html: string;
};

export type SendPayslipEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function periodLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}년 ${Number(month)}월`;
}

/** 단건 급여명세서 메일 발송 */
export async function sendPayslipEmail(
  input: SendPayslipEmailInput
): Promise<SendPayslipEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    return {
      ok: false,
      error: "RESEND_API_KEY가 설정되지 않았습니다.",
    };
  }

  const to = input.to.trim();
  if (!isValidEmail(to)) {
    return { ok: false, error: "이메일 형식이 올바르지 않습니다." };
  }

  const period = periodLabel(input.yearMonth);
  const fromEmail = getPayrollFromEmail();
  const fromName = getPayrollFromName();
  const subject = `[${fromName}] ${period} 급여명세서 — ${input.employeeName}`;
  const filename = `급여명세서_${input.employeeName}_${input.yearMonth}.html`;
  const attachmentContent = Buffer.from(input.html, "utf8").toString("base64");

  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html: input.html,
      attachments: [
        {
          filename,
          content: attachmentContent,
          contentType: "text/html; charset=utf-8",
        },
      ],
    });

    if (error) {
      return { ok: false, error: error.message || "발송에 실패했습니다." };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "발송 중 오류가 발생했습니다.";
    return { ok: false, error: message };
  }
}
