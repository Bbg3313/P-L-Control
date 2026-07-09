import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imagePath = path.join(root, "public/payroll/corporate-seal.png");
const outPath = path.join(root, "src/lib/payroll-corporate-seal.ts");

const base64 = fs.readFileSync(imagePath).toString("base64");
fs.writeFileSync(
  outPath,
  `export const PAYROLL_CORPORATE_SEAL_DATA_URI = "data:image/png;base64,${base64}";\n`
);

console.log(`Wrote ${outPath}`);
