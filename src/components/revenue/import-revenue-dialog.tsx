"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFinancial } from "@/contexts/financial-context";
import { formatCurrency } from "@/lib/format";
import {
  downloadRevenueTemplate,
  parseRevenueSpreadsheet,
  type RevenueImportRow,
} from "@/lib/revenue-import";

const ACCEPT =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

export function ImportRevenueDialog() {
  const { addRecords } = useFinancial();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<RevenueImportRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  function resetState() {
    setFileName(null);
    setPreview([]);
    setErrors([]);
    setParseError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    resetState();
    if (!file) return;

    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseRevenueSpreadsheet(buffer);
      setPreview(result.rows);
      setErrors(result.errors);
      if (result.rows.length === 0 && result.errors.length === 0) {
        setParseError("가져올 수 있는 행이 없습니다.");
      }
    } catch {
      setParseError("파일을 읽지 못했습니다. 엑셀(.xlsx) 또는 CSV 형식을 확인해 주세요.");
    }
  }

  function handleImport() {
    if (preview.length === 0) return;

    addRecords(
      preview.map((row) => ({
        date: row.date,
        client: row.client,
        category: row.category,
        amount: row.amount,
        type: "revenue" as const,
      }))
    );

    resetState();
    setOpen(false);
  }

  const previewTotal = preview.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetState();
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <Upload data-icon="inline-start" />
            엑셀 가져오기
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>엑셀에서 매출 가져오기</DialogTitle>
          <DialogDescription>
            첫 행에 <strong>날짜, 매출처, 카테고리, 금액</strong> 열을 두고 월말
            정리 파일을 업로드하세요. (.xlsx, .xls, .csv)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadRevenueTemplate}
            >
              <FileSpreadsheet data-icon="inline-start" />
              양식 다운로드 (CSV)
            </Button>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={handleFileChange}
            />
            {fileName && (
              <p className="mt-2 text-xs text-muted-foreground">
                선택: {fileName}
              </p>
            )}
          </div>

          {parseError && (
            <p className="text-sm text-destructive" role="alert">
              {parseError}
            </p>
          )}

          {errors.length > 0 && (
            <div className="max-h-28 overflow-y-auto rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              <p className="font-medium">건너뛴 행 ({errors.length}건)</p>
              <ul className="mt-1 list-inside list-disc">
                {errors.slice(0, 8).map((err) => (
                  <li key={`${err.row}-${err.message}`}>
                    {err.row}행: {err.message}
                  </li>
                ))}
                {errors.length > 8 && (
                  <li>…외 {errors.length - 8}건</li>
                )}
              </ul>
            </div>
          )}

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                미리보기 {preview.length}건 · 합계{" "}
                {formatCurrency(previewTotal)}
              </p>
              <div className="max-h-48 overflow-auto rounded-md border text-xs">
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">날짜</th>
                      <th className="px-2 py-1.5 text-left font-medium">매출처</th>
                      <th className="px-2 py-1.5 text-left font-medium">카테고리</th>
                      <th className="px-2 py-1.5 text-right font-medium">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 20).map((row, i) => (
                      <tr key={`${row.date}-${row.client}-${i}`} className="border-t">
                        <td className="px-2 py-1.5">{row.date}</td>
                        <td className="px-2 py-1.5">{row.client}</td>
                        <td className="px-2 py-1.5">{row.category}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 20 && (
                  <p className="border-t px-2 py-1.5 text-muted-foreground">
                    …외 {preview.length - 20}건
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            type="button"
            disabled={preview.length === 0}
            onClick={handleImport}
          >
            {preview.length > 0 ? `${preview.length}건 등록` : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
