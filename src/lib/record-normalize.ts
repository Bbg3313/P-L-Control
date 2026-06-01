import type { FinancialRecord } from "@/lib/types";

/** localStorage 이전 형식(description만 있던 매출) 호환 */
export function normalizeFinancialRecord(
  raw: Partial<FinancialRecord> & Pick<FinancialRecord, "id" | "date" | "amount" | "type">
): FinancialRecord {
  const client = (raw.client ?? "").trim();
  const description = (raw.description ?? "").trim();

  if (raw.type === "revenue") {
    const resolvedClient = client || description;
    return {
      id: raw.id,
      date: raw.date,
      client: resolvedClient,
      category: (raw.category ?? "").trim(),
      description: client ? description : "",
      amount: raw.amount,
      type: "revenue",
    };
  }

  return {
    id: raw.id,
    date: raw.date,
    client: "",
    category: (raw.category ?? "").trim(),
    description,
    amount: raw.amount,
    type: "expense",
  };
}

export function normalizeFinancialRecords(
  records: Partial<FinancialRecord>[]
): FinancialRecord[] {
  return records
    .filter((r) => r.id && r.date && r.type && typeof r.amount === "number")
    .map((r) =>
      normalizeFinancialRecord(
        r as Partial<FinancialRecord> &
          Pick<FinancialRecord, "id" | "date" | "amount" | "type">
      )
    );
}
