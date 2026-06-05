"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMPLOYMENT_STATUSES,
  createEmptyHrEmployeeInput,
  type EmploymentStatus,
  type HrEmployeeRecord,
  type HrEmployeeRecordInput,
} from "@/lib/hr-records-types";
import {
  formatEmploymentTenure,
  formatHrRecordDate,
  formatKoreanPhone,
  formatKoreanResidentId,
  statusBadgeClass,
} from "@/lib/hr-records-utils";
import { cn } from "@/lib/utils";

function recordToInput(record: HrEmployeeRecord): HrEmployeeRecordInput {
  return {
    department: record.department,
    status: record.status,
    position: record.position,
    name: record.name,
    acquiredDate: record.acquiredDate,
    lostDate: record.lostDate,
    residentId: record.residentId,
    bank: record.bank,
    accountNumber: record.accountNumber,
    phone: record.phone,
    address: record.address,
  };
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-sm text-slate-800",
          mono && "font-mono tabular-nums",
          !value || value === "—" ? "text-slate-400" : ""
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function EmployeeCard({
  record,
  onEdit,
  onDelete,
}: {
  record: HrEmployeeRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tenure = formatEmploymentTenure(
    record.acquiredDate,
    record.lostDate,
    record.status
  );

  return (
    <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <UserRound className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-900">
                  {record.name}
                </h2>
                <p className="truncate text-sm text-slate-600">
                  {[record.position, record.department].filter(Boolean).join(" · ") ||
                    "직위·소속 미입력"}
                </p>
                {tenure && (
                  <p className="mt-1 text-sm font-medium text-violet-700">
                    {tenure}
                  </p>
                )}
              </div>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
              statusBadgeClass(record.status)
            )}
          >
            {record.status}
          </span>
        </div>
      </div>

      <dl className="grid flex-1 gap-3 px-4 py-3.5 sm:grid-cols-2">
        <FieldRow label="입사일자" value={formatHrRecordDate(record.acquiredDate)} />
        <FieldRow label="상실일자" value={formatHrRecordDate(record.lostDate)} />
        <FieldRow
          label="주민번호"
          value={formatKoreanResidentId(record.residentId) || record.residentId}
          mono
        />
        <FieldRow
          label="연락처"
          value={formatKoreanPhone(record.phone) || record.phone}
          mono
        />
        <FieldRow
          label="은행"
          value={record.bank}
        />
        <FieldRow
          label="계좌번호"
          value={record.accountNumber}
          mono
        />
        <div className="min-w-0 sm:col-span-2">
          <FieldRow label="주소" value={record.address} />
        </div>
      </dl>

      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil data-icon="inline-start" />
          수정
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 data-icon="inline-start" />
          삭제
        </Button>
      </div>
    </article>
  );
}

function EmployeeForm({
  value,
  onChange,
}: {
  value: HrEmployeeRecordInput;
  onChange: (next: HrEmployeeRecordInput) => void;
}) {
  const set = (key: keyof HrEmployeeRecordInput, fieldValue: string) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="hr-name">이름 *</Label>
        <Input
          id="hr-name"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="홍길동"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hr-department">소속</Label>
        <Input
          id="hr-department"
          value={value.department}
          onChange={(e) => set("department", e.target.value)}
          placeholder="마케팅팀"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hr-status">재직</Label>
        <select
          id="hr-status"
          value={value.status}
          onChange={(e) => set("status", e.target.value as EmploymentStatus)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {EMPLOYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hr-position">직위</Label>
        <Input
          id="hr-position"
          value={value.position}
          onChange={(e) => set("position", e.target.value)}
          placeholder="대리"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hr-phone">연락처</Label>
        <Input
          id="hr-phone"
          value={value.phone}
          onChange={(e) => set("phone", formatKoreanPhone(e.target.value))}
          placeholder="010-0000-0000"
          inputMode="tel"
          className="font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hr-acquired">입사일자</Label>
        <Input
          id="hr-acquired"
          type="date"
          value={value.acquiredDate}
          onChange={(e) => set("acquiredDate", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hr-lost">상실일자</Label>
        <Input
          id="hr-lost"
          type="date"
          value={value.lostDate}
          onChange={(e) => set("lostDate", e.target.value)}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="hr-resident">주민번호</Label>
        <Input
          id="hr-resident"
          value={value.residentId}
          onChange={(e) =>
            set("residentId", formatKoreanResidentId(e.target.value))
          }
          inputMode="numeric"
          placeholder="000000-0000000"
          className="font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hr-bank">은행</Label>
        <Input
          id="hr-bank"
          value={value.bank}
          onChange={(e) => set("bank", e.target.value)}
          placeholder="국민은행"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hr-account">계좌번호</Label>
        <Input
          id="hr-account"
          value={value.accountNumber}
          onChange={(e) => set("accountNumber", e.target.value)}
          placeholder="000-00-000000"
          className="font-mono"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="hr-address">주소</Label>
        <Input
          id="hr-address"
          value={value.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="서울특별시 ..."
        />
      </div>
    </div>
  );
}

export function HrRecordsPage() {
  const [records, setRecords] = useState<HrEmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageConfigured, setStorageConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HrEmployeeRecordInput>(createEmptyHrEmployeeInput());

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hr-records", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "목록을 불러오지 못했습니다.");
      }
      const data = (await res.json()) as {
        records: HrEmployeeRecord[];
        _meta?: { storageConfigured?: boolean };
      };
      setRecords(data.records ?? []);
      setStorageConfigured(data._meta?.storageConfigured ?? true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  function openCreate() {
    setEditingId(null);
    setForm(createEmptyHrEmployeeInput());
    setDialogOpen(true);
  }

  function openEdit(record: HrEmployeeRecord) {
    setEditingId(record.id);
    setForm(recordToInput(record));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit ? `/api/hr-records/${editingId}` : "/api/hr-records",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "저장하지 못했습니다.");
      }

      setDialogOpen(false);
      setMessage(isEdit ? "수정했습니다." : "인사카드를 추가했습니다.");
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: HrEmployeeRecord) {
    if (!window.confirm(`「${record.name}」 인사기록을 삭제할까요?`)) return;

    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/hr-records/${record.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "삭제하지 못했습니다.");
      }
      setMessage("삭제했습니다.");
      await loadRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    }
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <header className="sticky top-0 z-30 w-full shrink-0 border-b border-slate-200/80 bg-slate-50/95 pb-4 shadow-sm backdrop-blur-sm">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">인사기록부</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            직원 1명씩 인사카드로 등록·관리합니다.
          </p>
        </div>
      </header>

      <div className="w-full min-w-0 space-y-4 pb-6 pt-4">
      {!storageConfigured && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          서버 저장소(Redis)가 연결되지 않아 이 브라우저에서는 저장할 수 없습니다.
          Vercel에 Upstash Redis를 연결한 뒤 다시 배포해 주세요.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground tabular-nums">
          등록 {records.length}명
        </p>
        <Button
          type="button"
          disabled={!storageConfigured}
          onClick={openCreate}
        >
          <Plus data-icon="inline-start" />
          직원 추가
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="text-sm text-emerald-700">{message}</p>
      )}

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          불러오는 중…
        </p>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center">
          <UserRound className="mx-auto h-10 w-10 text-violet-400/80" />
          <p className="mt-4 text-sm font-medium text-slate-800">
            등록된 직원이 없습니다
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            「직원 추가」로 인사기록을 하나씩 등록해 주세요.
          </p>
          <Button
            type="button"
            className="mt-6"
            disabled={!storageConfigured}
            onClick={openCreate}
          >
            <Plus data-icon="inline-start" />
            첫 직원 추가
          </Button>
        </div>
      ) : (
        <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(260px,300px))] gap-4">
          {records.map((record) => (
            <EmployeeCard
              key={record.id}
              record={record}
              onEdit={() => openEdit(record)}
              onDelete={() => void handleDelete(record)}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "인사기록 수정" : "직원 추가"}
            </DialogTitle>
          </DialogHeader>
          <EmployeeForm value={form} onChange={setForm} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
            >
              취소
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : null}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
