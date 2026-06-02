"use client";

import { useCallback, useMemo } from "react";
import { useFinancial } from "@/contexts/financial-context";
import { formatCurrency } from "@/lib/format";
import { isOverseasTeam, type PersonnelEntry } from "@/lib/personnel";
import { PersonnelCard } from "./personnel-card";

function updateEntry(
  personnel: PersonnelEntry[],
  id: string,
  patch: Partial<PersonnelEntry>
): PersonnelEntry[] {
  return personnel.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

function PersonnelGroup({
  label,
  entries,
  onUpdate,
}: {
  label: string;
  entries: PersonnelEntry[];
  onUpdate: (id: string, patch: Partial<PersonnelEntry>) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => (
          <PersonnelCard
            key={entry.id}
            entry={entry}
            onUpdate={(patch) => onUpdate(entry.id, patch)}
          />
        ))}
      </div>
    </section>
  );
}

export function PersonnelSection() {
  const { personnel, personnelMonthlyTotal, updatePersonnel, hydrated } =
    useFinancial();

  const { domestic, overseasList } = useMemo(() => {
    const domestic: PersonnelEntry[] = [];
    const overseasList: PersonnelEntry[] = [];
    for (const p of personnel) {
      if (isOverseasTeam(p.name)) overseasList.push(p);
      else domestic.push(p);
    }
    return { domestic, overseasList };
  }, [personnel]);

  const handleUpdate = useCallback(
    (id: string, patch: Partial<PersonnelEntry>) => {
      updatePersonnel(updateEntry(personnel, id, patch));
    },
    [personnel, updatePersonnel]
  );

  if (!hydrated) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        인건비 데이터를 불러오는 중…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        연봉·월급만 입력하면 월 비용이 자동 계산됩니다. 카드 하단에서 상세를
        펼칠 수 있습니다.
      </p>

      <PersonnelGroup
        label={`국내 · ${domestic.length}명`}
        entries={domestic}
        onUpdate={handleUpdate}
      />
      <PersonnelGroup
        label={`해외 · ${overseasList.length}명`}
        entries={overseasList}
        onUpdate={handleUpdate}
      />

      <div className="flex items-center justify-between rounded-xl bg-slate-900 px-5 py-4 text-white shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-400">월 합계</p>
          <p className="text-sm text-slate-300">{personnel.length}명</p>
        </div>
        <p className="text-xl font-bold tabular-nums tracking-tight">
          {formatCurrency(personnelMonthlyTotal)}
        </p>
      </div>
    </div>
  );
}
