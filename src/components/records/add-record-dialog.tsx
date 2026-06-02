"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFinancial } from "@/contexts/financial-context";
import { getCategorySuggestions } from "@/lib/category-suggestions";
import { parseAmountInput } from "@/lib/calculations";
import { normalizeAmountInputString } from "@/lib/format";
import {
  REVENUE_DETAIL_CATEGORIES,
  type RevenueDetailCategory,
} from "@/lib/revenue-detail-categories";
import type { TransactionType } from "@/lib/types";

interface AddRecordDialogProps {
  type: TransactionType;
}

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  category: "",
  description: "",
  detailCategory: REVENUE_DETAIL_CATEGORIES[0] as RevenueDetailCategory,
  amount: "",
  amountIncludesVat: false,
});

export function AddRecordDialog({ type }: AddRecordDialogProps) {
  const { addRecord } = useFinancial();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const suggestions = getCategorySuggestions(type);
  const isExpense = type === "expense";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const category = form.category.trim();
    const description = form.description.trim();
    const amount = parseAmountInput(form.amount);

    if (!form.date) {
      setError("날짜를 선택해 주세요.");
      return;
    }
    if (!category) {
      setError("카테고리를 입력해 주세요.");
      return;
    }
    if (!description) {
      setError("내역을 입력해 주세요.");
      return;
    }
    if (amount <= 0) {
      setError("금액은 0보다 커야 합니다.");
      return;
    }

    addRecord({
      date: form.date,
      category,
      description,
      amount,
      type,
      amountIncludesVat: form.amountIncludesVat,
      ...(!isExpense ? { detailCategory: form.detailCategory } : {}),
    });

    setForm(emptyForm());
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus data-icon="inline-start" />
            기록 추가
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isExpense ? "비용 기록 추가" : "매출 기록 추가"}</DialogTitle>
            <DialogDescription>
              {isExpense
                ? "인건비, 사무실비용, 광고비 등 카테고리를 직접 입력할 수 있습니다."
                : "매출 항목을 수기로 등록합니다. 브라우저에 저장됩니다."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="date">날짜</Label>
              <Input
                id="date"
                type="date"
                required
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>

            {!isExpense && (
              <div className="grid gap-2">
                <Label htmlFor="detailCategory">상세 카테고리</Label>
                <select
                  id="detailCategory"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.detailCategory}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      detailCategory: e.target.value as RevenueDetailCategory,
                    }))
                  }
                >
                  {REVENUE_DETAIL_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="category">
                {isExpense ? "카테고리" : "매출처"}
              </Label>
              <Input
                id="category"
                list={isExpense ? `category-suggestions-${type}` : undefined}
                placeholder={
                  isExpense ? "예: 인건비, 사무실비용, 광고비" : "예: OO브랜드"
                }
                required
                value={isExpense ? form.category : form.description}
                onChange={(e) =>
                  setForm((f) =>
                    isExpense
                      ? { ...f, category: e.target.value }
                      : { ...f, description: e.target.value }
                  )
                }
              />
              {isExpense && (
                <datalist id={`category-suggestions-${type}`}>
                  {suggestions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">
                {isExpense ? "내역" : "카테고리"}
              </Label>
              <Input
                id="description"
                list={!isExpense ? `category-suggestions-${type}` : undefined}
                placeholder={isExpense ? "상세 설명" : "예: 대행 수수료"}
                required
                value={isExpense ? form.description : form.category}
                onChange={(e) =>
                  setForm((f) =>
                    isExpense
                      ? { ...f, description: e.target.value }
                      : { ...f, category: e.target.value }
                  )
                }
              />
              {!isExpense && (
                <datalist id={`category-suggestions-${type}`}>
                  {suggestions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">금액 (원)</Label>
              <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={form.amountIncludesVat ? "outline" : "default"}
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({ ...f, amountIncludesVat: false }))
                    }
                  >
                    무자료
                  </Button>
                  <Button
                    type="button"
                    variant={form.amountIncludesVat ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({ ...f, amountIncludesVat: true }))
                    }
                  >
                    계산서 발행
                  </Button>
              </div>
              <Input
                id="amount"
                inputMode="numeric"
                placeholder="예: 5,000,000"
                required
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    amount: normalizeAmountInputString(e.target.value),
                  }))
                }
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
