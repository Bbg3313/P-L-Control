"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinancial } from "@/contexts/financial-context";
import {
  DEFAULT_PAYROLL_FROM_EMAIL,
  DEFAULT_PAYROLL_FROM_NAME,
} from "@/lib/payroll-email-constants";
import {
  filterPersonnelByPayrollCompany,
  PAYROLL_COMPANY_OPTIONS,
} from "@/lib/payroll-ledger";
import {
  loadPersonnelEmailEntries,
  removePersonnelEmailEntry,
  savePersonnelEmailEntries,
  updatePersonnelEmailEntryEmail,
  upsertPersonnelEmailEntry,
  type PersonnelEmailEntry,
} from "@/lib/personnel-emails-store";
import { formatPersonnelDisplayName } from "@/lib/personnel";
import { cn } from "@/lib/utils";

function isLikelyEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function PayslipMailManagePage() {
  const { personnel, hydrated } = useFinancial();
  const [entries, setEntries] = useState<PersonnelEmailEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    setEntries(loadPersonnelEmailEntries());
    setReady(true);
  }, []);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [entries]
  );

  /** 급여대장 등록 인원(블루브릿지·골드펜더, 월 무관) 중 미등록분 */
  const availableNames = useMemo(() => {
    const onLedger = new Set<string>();
    for (const company of PAYROLL_COMPANY_OPTIONS) {
      for (const entry of filterPersonnelByPayrollCompany(
        personnel,
        company.id
      )) {
        onLedger.add(entry.name);
      }
    }
    const registered = new Set(entries.map((e) => e.name));
    return Array.from(onLedger)
      .filter((name) => !registered.has(name))
      .sort((a, b) => a.localeCompare(b, "ko"));
  }, [personnel, entries]);

  useEffect(() => {
    if (newName && !availableNames.includes(newName)) {
      setNewName("");
    }
  }, [availableNames, newName]);

  function persist(next: PersonnelEmailEntry[]) {
    setEntries(next);
    savePersonnelEmailEntries(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleAdd() {
    setError(null);
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name) {
      setError("급여대장 명단에서 이름을 선택해 주세요.");
      return;
    }
    if (!availableNames.includes(name)) {
      setError(
        "선택한 인원은 현재 급여대장 명단에 없거나 이미 등록되어 있습니다."
      );
      return;
    }
    if (!email) {
      setError("이메일을 입력해 주세요.");
      return;
    }
    if (!isLikelyEmail(email)) {
      setError("이메일 형식을 확인해 주세요.");
      return;
    }
    persist(upsertPersonnelEmailEntry(entries, name, email));
    setNewName("");
    setNewEmail("");
  }

  function handleDelete(name: string) {
    if (!window.confirm(`「${name}」을(를) 발송 목록에서 삭제할까요?`)) return;
    persist(removePersonnelEmailEntry(entries, name));
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <header className="sticky top-0 z-30 w-full shrink-0 border-b border-slate-200/80 bg-slate-50/95 pb-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              명세서 일괄 발송 관리
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              급여명세서 수신 인원·메일 주소를 관리합니다. 급여대장의 「명세서
              일괄 발송」에서 사용됩니다.
            </p>
          </div>
          {savedFlash ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              저장됨
            </span>
          ) : null}
        </div>
      </header>

      <div className="w-full min-w-0 space-y-4 pb-6 pt-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          발신:{" "}
          <span className="font-medium text-slate-900">
            {DEFAULT_PAYROLL_FROM_NAME} &lt;{DEFAULT_PAYROLL_FROM_EMAIL}&gt;
          </span>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">인원 추가</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hydrated
              ? "급여대장에 등록된 인원 전체에서 선택합니다. (9월 신규 등 포함)"
              : "급여대장 명단을 불러오는 중…"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="payslip-new-name">이름</Label>
              <select
                id="payslip-new-name"
                value={newName}
                disabled={!hydrated || availableNames.length === 0}
                onChange={(e) => {
                  setError(null);
                  setNewName(e.target.value);
                }}
                className={selectClassName}
              >
                <option value="">
                  {availableNames.length === 0
                    ? "추가할 인원이 없습니다"
                    : "급여대장에서 선택"}
                </option>
                {availableNames.map((name) => (
                  <option key={name} value={name}>
                    {formatPersonnelDisplayName(name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payslip-new-email">이메일</Label>
              <Input
                id="payslip-new-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={newEmail}
                disabled={availableNames.length === 0}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={availableNames.length === 0}
                onClick={handleAdd}
              >
                <Plus data-icon="inline-start" />
                추가
              </Button>
            </div>
          </div>
          {error ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">발송 목록</h2>
              <p className="text-sm text-muted-foreground">
                {ready ? `${entries.length}명` : "불러오는 중…"}
              </p>
            </div>
            <Mail className="h-4 w-4 text-slate-400" />
          </div>

          {!ready ? (
            <p className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              불러오는 중…
            </p>
          ) : sortedEntries.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-muted-foreground">
              등록된 인원이 없습니다. 위에서 추가해 주세요.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedEntries.map((entry) => {
                const emailInvalid =
                  Boolean(entry.email) && !isLikelyEmail(entry.email);
                return (
                  <li
                    key={entry.name}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 sm:w-44 sm:shrink-0">
                      <p className="break-words text-sm font-medium text-slate-900">
                        {formatPersonnelDisplayName(entry.name)}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        aria-label={`${entry.name} 이메일`}
                        value={entry.email}
                        className={cn(
                          emailInvalid &&
                            "border-destructive focus-visible:border-destructive"
                        )}
                        onChange={(e) => {
                          setEntries(
                            updatePersonnelEmailEntryEmail(
                              entries,
                              entry.name,
                              e.target.value
                            )
                          );
                        }}
                        onBlur={(e) => {
                          persist(
                            updatePersonnelEmailEntryEmail(
                              entries,
                              entry.name,
                              e.target.value
                            )
                          );
                        }}
                        placeholder="name@example.com"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 self-end text-destructive hover:text-destructive sm:self-center"
                      onClick={() => handleDelete(entry.name)}
                    >
                      <Trash2 data-icon="inline-start" />
                      삭제
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
