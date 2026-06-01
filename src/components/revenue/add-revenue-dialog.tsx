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
import { REVENUE_CATEGORY_SUGGESTIONS } from "@/lib/category-suggestions";
import { parseAmountInput } from "@/lib/calculations";

const emptyForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  client: "",
  category: "",
  amount: "",
});

export function AddRevenueDialog() {
  const { addRecord } = useFinancial();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const client = form.client.trim();
    const category = form.category.trim();
    const amount = parseAmountInput(form.amount);

    if (!form.date) {
      setError("날짜를 선택해 주세요.");
      return;
    }
    if (!client) {
      setError("매출처를 입력해 주세요.");
      return;
    }
    if (!category) {
      setError("카테고리를 입력해 주세요.");
      return;
    }
    if (amount <= 0) {
      setError("금액은 0보다 커야 합니다.");
      return;
    }

    addRecord({
      date: form.date,
      client,
      category,
      amount,
      type: "revenue",
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
            매출 추가
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>매출 추가</DialogTitle>
            <DialogDescription>
              날짜, 매출처, 카테고리, 금액을 입력합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rev-date">날짜</Label>
              <Input
                id="rev-date"
                type="date"
                required
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rev-client">매출처</Label>
              <Input
                id="rev-client"
                placeholder="예: OO브랜드"
                required
                value={form.client}
                onChange={(e) =>
                  setForm((f) => ({ ...f, client: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rev-category">카테고리</Label>
              <Input
                id="rev-category"
                list="revenue-category-suggestions"
                placeholder="예: 대행 수수료, 컨설팅"
                required
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              />
              <datalist id="revenue-category-suggestions">
                {REVENUE_CATEGORY_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rev-amount">금액 (원)</Label>
              <Input
                id="rev-amount"
                inputMode="numeric"
                placeholder="예: 5000000"
                required
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
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
