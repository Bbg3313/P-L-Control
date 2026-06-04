import { parseAnnualSalaryFromContractText } from "../src/lib/hr-contract-salary.ts";

const samples = [
  ["연봉 : 36,000,000원", 36_000_000],
  ["총 연봉금액 48,000,000 원", 48_000_000],
  ["연\n봉\n36,000,000원", 36_000_000],
  ["연봉금 3600만원", 36_000_000],
  ["월 급여 3,000,000원 (연봉 환산)", null],
  ["급여 월 3,000,000원", null],
  ["연    봉    :    36,000,000", 36_000_000],
  ["보수 총액 42,000,000원", 42_000_000],
];

for (const [text, expected] of samples) {
  const r = parseAnnualSalaryFromContractText(text);
  const ok =
    expected === null
      ? r.annualSalary === null
      : r.annualSalary === expected;
  console.log(ok ? "OK" : "FAIL", text.slice(0, 35), "=>", r);
}
