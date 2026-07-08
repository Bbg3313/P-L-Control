/**
 * 2026.3.1~ 근로소득 간이세액표 (nodong.kr 기준) → JSON 생성
 * 실행: node scripts/generate-simplified-tax-table.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../src/data/simplified-tax-table-2026.json");

function isNewRowStart(tokens, i, prevUpper) {
  const lower = Number(tokens[i]);
  const upper = Number(tokens[i + 1]);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return false;
  if (upper <= lower || upper - lower > 120) return false;
  return lower >= prevUpper - 1 && lower <= prevUpper + 5;
}

function parseTableLine(line) {
  const tokens = line.trim().split(/\s+/);
  const rows = [];

  for (let i = 0; i < tokens.length; ) {
    const lower = Number(tokens[i]);
    const upper = Number(tokens[i + 1]);
    if (
      !Number.isFinite(lower) ||
      !Number.isFinite(upper) ||
      upper <= lower ||
      upper > 10_000
    ) {
      i += 1;
      continue;
    }

    i += 2;
    const taxes = [];
    for (let c = 0; c < 6; c += 1) {
      taxes.push(tokens[i] === "-" ? 0 : Number(tokens[i]));
      i += 1;
    }
    while (i < tokens.length && !isNewRowStart(tokens, i, upper)) {
      i += 1;
    }
    rows.push([lower, upper, ...taxes]);
  }

  return rows;
}

async function main() {
  const cachePath = path.join(
    __dirname,
    "../.cache/nodong-income-tax-table.txt"
  );
  let line = "";

  if (fs.existsSync(cachePath)) {
    line = fs
      .readFileSync(cachePath, "utf8")
      .split("\n")
      .find((row) => /770\s+775/.test(row)) ?? "";
  }

  if (!line) {
    const res = await fetch("https://www.nodong.kr/income_tax");
    const html = await res.text();
    line =
      html
        .replace(/<[^>]+>/g, " ")
        .split("\n")
        .find((row) => /770\s+775/.test(row)) ?? "";
  }

  if (!line) {
    throw new Error("간이세액표 원본 행을 찾지 못했습니다.");
  }

  const rows = parseTableLine(line);
  if (rows.length < 500) {
    throw new Error(`간이세액표 파싱 실패 (rows=${rows.length})`);
  }

  const payload = {
    effectiveFrom: "2026-03-01",
    label: "2026년 3월 1일 개정 근로소득 간이세액표",
    unit: "천원",
    familyColumns: 6,
    rows,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log(`Saved ${rows.length} rows → ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
