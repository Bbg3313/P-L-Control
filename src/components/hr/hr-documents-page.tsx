"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  HR_DOCUMENT_CATEGORIES,
  type HrDocumentCategory,
  type HrDocumentMeta,
} from "@/lib/hr-documents-types";
import {
  formatFileSize,
  formatUploadTimestamp,
  validateHrUploadFile,
} from "@/lib/hr-file-utils";
import { HR_DOCUMENT_MAX_BYTES } from "@/lib/hr-file-utils";
import { cn } from "@/lib/utils";

type FilterCategory = HrDocumentCategory | "전체";

export function HrDocumentsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<HrDocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [storageConfigured, setStorageConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [category, setCategory] = useState<HrDocumentCategory>("근로계약서");
  const [filter, setFilter] = useState<FilterCategory>("전체");
  const [dragOver, setDragOver] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hr-documents", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "목록을 불러오지 못했습니다.");
      }
      const data = (await res.json()) as {
        documents: HrDocumentMeta[];
        _meta?: { storageConfigured?: boolean };
      };
      setDocuments(data.documents ?? []);
      setStorageConfigured(data._meta?.storageConfigured ?? true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다.");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filtered = useMemo(() => {
    if (filter === "전체") return documents;
    return documents.filter((d) => d.category === filter);
  }, [documents, filter]);

  const countsByCategory = useMemo(() => {
    const map = new Map<FilterCategory, number>();
    map.set("전체", documents.length);
    for (const cat of HR_DOCUMENT_CATEGORIES) {
      map.set(cat, documents.filter((d) => d.category === cat).length);
    }
    return map;
  }, [documents]);

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setError(null);
    setMessage(null);

    let success = 0;
    const failures: string[] = [];

    for (const file of list) {
      const validationError = validateHrUploadFile(file);
      if (validationError) {
        failures.push(`${file.name}: ${validationError}`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      try {
        const res = await fetch("/api/hr-documents", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          failures.push(`${file.name}: ${data.error ?? "업로드 실패"}`);
          continue;
        }
        success += 1;
      } catch {
        failures.push(`${file.name}: 네트워크 오류`);
      }
    }

    await loadDocuments();
    setUploading(false);

    if (success > 0) {
      setMessage(`${success}건 업로드했습니다.`);
    }
    if (failures.length > 0) {
      setError(failures.slice(0, 3).join(" · ") + (failures.length > 3 ? " …" : ""));
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) void uploadFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    if (e.dataTransfer.files.length > 0) {
      void uploadFiles(e.dataTransfer.files);
    }
  }

  async function handleDelete(doc: HrDocumentMeta) {
    if (!window.confirm(`「${doc.name}」을(를) 삭제할까요?`)) return;

    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/hr-documents/${doc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "삭제하지 못했습니다.");
      }
      setMessage("삭제했습니다.");
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제하지 못했습니다.");
    }
  }

  const filterOptions: FilterCategory[] = ["전체", ...HR_DOCUMENT_CATEGORIES];

  return (
    <div className="w-full max-w-full space-y-4 pb-6 pt-4">
      <p className="text-sm text-muted-foreground">
        근로계약서·비밀유지서약서 등 서류를 업로드하고 팀과 공유합니다.
        (대시보드 미반영)
      </p>
        {!storageConfigured && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="status"
          >
            서버 저장소(Redis)가 연결되지 않아 이 브라우저에서는 파일을 저장할 수
            없습니다. Vercel에 Upstash Redis를 연결한 뒤 다시 배포해 주세요.
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">업로드 분류:</span>
            {HR_DOCUMENT_CATEGORIES.map((cat) => (
              <Button
                key={cat}
                type="button"
                size="sm"
                variant={category === cat ? "default" : "outline"}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            disabled={uploading || !storageConfigured}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Upload data-icon="inline-start" />
            )}
            파일 업로드
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx,.jpg,.jpeg,.png,.webp,.zip,.txt,.csv"
            onChange={handleFileInput}
          />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragOver
              ? "border-violet-400 bg-violet-50/80"
              : "border-slate-200 bg-white/60",
            (!storageConfigured || uploading) && "pointer-events-none opacity-60"
          )}
        >
          <FolderOpen className="mx-auto h-10 w-10 text-violet-500/80" />
          <p className="mt-3 text-sm font-medium text-slate-800">
            파일을 여기에 끌어다 놓거나 「파일 업로드」를 누르세요
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF · DOC · XLS · HWP · 이미지 · ZIP 등 · 최대{" "}
            {formatFileSize(HR_DOCUMENT_MAX_BYTES)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={filter === cat ? "secondary" : "ghost"}
              onClick={() => setFilter(cat)}
            >
              {cat}
              <span className="ml-1 tabular-nums text-muted-foreground">
                ({countsByCategory.get(cat) ?? 0})
              </span>
            </Button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {message && !error && (
          <p className="text-sm text-emerald-700">{message}</p>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              불러오는 중…
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {filter === "전체"
                ? "등록된 서류가 없습니다. 파일을 업로드해 주세요."
                : `「${filter}」 분류에 서류가 없습니다.`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b bg-slate-50/80 text-left text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">분류</th>
                    <th className="px-4 py-3">크기</th>
                    <th className="px-4 py-3">업로드</th>
                    <th className="px-4 py-3 text-right">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-violet-500" />
                          <span className="truncate font-medium text-slate-900">
                            {doc.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{doc.category}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {formatFileSize(doc.size)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatUploadTimestamp(doc.uploadedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <a
                            href={`/api/hr-documents/${doc.id}`}
                            download={doc.name}
                            className={buttonVariants({
                              variant: "outline",
                              size: "sm",
                            })}
                          >
                            <Download data-icon="inline-start" />
                            다운로드
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="삭제"
                            onClick={() => void handleDelete(doc)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
}
