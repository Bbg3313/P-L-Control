import { getFileExtension } from "@/lib/hr-file-utils";
import type {
  HrDocumentCategory,
  HrSalaryExtractStatus,
} from "@/lib/hr-documents-types";

export interface HrSalaryExtractionResult {
  annualSalary: number | null;
  status: HrSalaryExtractStatus;
}

const MIN_ANNUAL_SALARY = 15_000_000;
const MAX_ANNUAL_SALARY = 1_500_000_000;

interface SalaryCandidate {
  amount: number;
  score: number;
}

function parseDigits(raw: string): number {
  const n = Number.parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function toAnnualAmount(value: number, unit: "won" | "man" | "eok-man"): number {
  if (unit === "man") return value * 10_000;
  if (unit === "eok-man") return value * 100_000_000;
  return value;
}

function isPlausibleAnnual(amount: number): boolean {
  return amount >= MIN_ANNUAL_SALARY && amount <= MAX_ANNUAL_SALARY;
}

function scoreLineContext(line: string): number {
  let score = 0;
  const normalized = line.replace(/\s+/g, "");

  if (/연봉.*총|총.*연봉|연봉총액|연봉금액/.test(normalized)) score += 30;
  if (normalized.includes("연봉")) score += 20;
  if (/급여총액|보수총액|임금총액/.test(normalized)) score += 12;
  if (/월급|월급여|월임금|매월|월별|월\s*지급/.test(normalized)) score -= 25;
  if (/일급|시급|시간당/.test(normalized)) score -= 30;
  if (/상여|인센티브|성과급/.test(normalized) && !normalized.includes("연봉")) {
    score -= 8;
  }

  return score;
}

function pushCandidate(
  candidates: SalaryCandidate[],
  amount: number,
  contextScore: number,
  bonus: number
) {
  if (isPlausibleAnnual(amount)) {
    candidates.push({ amount, score: contextScore + bonus });
  }
}

function collectCandidatesFromLine(line: string): SalaryCandidate[] {
  const candidates: SalaryCandidate[] = [];
  const contextScore = scoreLineContext(line);

  const amountPatterns: RegExp[] = [
    /연봉\s*(?:총\s*)?(?:금액|액)?\s*[:：]?\s*([0-9,]+)\s*(만\s*)?원?/gi,
    /(?:총\s*)?연봉\s*[:：]?\s*([0-9,]+)\s*(만\s*)?원?/gi,
    /급여\s*총액\s*[:：]?\s*([0-9,]+)\s*(만\s*)?원?/gi,
    /보수\s*총액\s*[:：]?\s*([0-9,]+)\s*(만\s*)?원?/gi,
    /연\s*봉\s*금?\s*[:：]?\s*([0-9,]+)\s*(만\s*)?원?/gi,
  ];

  for (const regex of amountPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      const digits = parseDigits(match[1]);
      const hasMan = Boolean(match[2]);
      const amount = hasMan
        ? toAnnualAmount(digits, "man")
        : digits >= 1_000_000
          ? digits
          : toAnnualAmount(digits, "man");
      pushCandidate(candidates, amount, contextScore, hasMan ? 10 : 6);
    }
  }

  const eokMan = /([0-9,]+)\s*억\s*([0-9,]+)?\s*만?\s*원?/gi;
  let eokMatch: RegExpExecArray | null;
  while ((eokMatch = eokMan.exec(line)) !== null) {
    const eok = parseDigits(eokMatch[1]);
    const man = eokMatch[2] ? parseDigits(eokMatch[2]) : 0;
    pushCandidate(
      candidates,
      eok * 100_000_000 + man * 10_000,
      contextScore,
      22
    );
  }

  const cheonMan = /([0-9,]+)\s*천\s*만\s*원?/gi;
  let cheonMatch: RegExpExecArray | null;
  while ((cheonMatch = cheonMan.exec(line)) !== null) {
    pushCandidate(
      candidates,
      parseDigits(cheonMatch[1]) * 10_000_000,
      contextScore,
      14
    );
  }

  if (contextScore >= 15) {
    const manWon = /([0-9,]+)\s*만\s*원?/gi;
    let manMatch: RegExpExecArray | null;
    while ((manMatch = manWon.exec(line)) !== null) {
      pushCandidate(
        candidates,
        toAnnualAmount(parseDigits(manMatch[1]), "man"),
        contextScore,
        8
      );
    }
  }

  return candidates;
}

export function parseAnnualSalaryFromContractText(
  text: string
): HrSalaryExtractionResult {
  const normalized = text.replace(/\u00a0/g, " ").trim();
  if (!normalized) {
    return { annualSalary: null, status: "not_found" };
  }

  const lines = normalized.split(/\r?\n/);
  const allCandidates: SalaryCandidate[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    allCandidates.push(...collectCandidatesFromLine(line));
  }

  if (allCandidates.length === 0) {
    allCandidates.push(...collectCandidatesFromLine(normalized));
  }

  if (allCandidates.length === 0) {
    return { annualSalary: null, status: "not_found" };
  }

  allCandidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
  const best = allCandidates[0];

  return { annualSalary: best.amount, status: "found" };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfModule = await import("pdf-parse");
  const pdfParse =
    typeof pdfModule === "function"
      ? pdfModule
      : "default" in pdfModule &&
          typeof (pdfModule as { default: unknown }).default === "function"
        ? (pdfModule as { default: (buf: Buffer) => Promise<{ text?: string }> })
            .default
        : null;
  if (!pdfParse) return "";
  const result = await pdfParse(buffer);
  return result.text ?? "";
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

export async function extractTextFromHrDocument(input: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}): Promise<string | null> {
  const ext = getFileExtension(input.filename);
  const mime = input.mimeType.toLowerCase();

  try {
    if (mime.includes("pdf") || ext === "pdf") {
      return await extractPdfText(input.buffer);
    }
    if (
      mime.includes("wordprocessingml") ||
      mime.includes("msword") ||
      ext === "docx"
    ) {
      return await extractDocxText(input.buffer);
    }
    if (ext === "txt" || mime.startsWith("text/")) {
      return input.buffer.toString("utf-8");
    }
  } catch {
    return null;
  }

  return null;
}

export async function extractAnnualSalaryFromContract(input: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  category: HrDocumentCategory;
}): Promise<HrSalaryExtractionResult> {
  if (input.category !== "근로계약서") {
    return { annualSalary: null, status: "skipped" };
  }

  const text = await extractTextFromHrDocument(input);
  if (text === null) {
    return { annualSalary: null, status: "unsupported" };
  }

  return parseAnnualSalaryFromContractText(text);
}
