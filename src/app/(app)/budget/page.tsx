"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatIDR, isSameMonth } from "@/lib/okane";
import type { Category } from "@/lib/types";
import { useOkaneStore, type OkaneState } from "@/stores/okane-store";
import { useAppStore } from "@/store/okane-store";

const categoryFormSchema = z.object({
  name: z.string().min(1),
  budget: z.coerce.number().min(0)
});

function CategoryRow({
  category,
  spent,
  onEdit,
  onDelete,
  onBudgetChange
}: {
  category: Category;
  spent: number;
  onEdit: () => void;
  onDelete: () => void;
  onBudgetChange: (next: number) => void;
}) {
  const ratio =
    category.budget > 0
      ? spent / category.budget
      : spent > 0
        ? Number.POSITIVE_INFINITY
        : 0;
  const percentRaw =
    category.budget > 0 ? Math.round(ratio * 100) : spent > 0 ? 999 : 0;
  const percent = Math.min(100, Math.max(0, percentRaw));

  const status =
    ratio > 1
      ? {
          label: "Melebihi budget",
          variant: "destructive" as const,
          indicatorClassName: "bg-rose-600"
        }
      : ratio >= 0.7
        ? {
            label: "Hampir habis",
            variant: "warning" as const,
            indicatorClassName: "bg-amber-500"
          }
        : {
            label: "Aman",
            variant: "success" as const,
            indicatorClassName: "bg-emerald-600"
          };

  return (
    <div className="space-y-3 rounded-2xl border bg-background p-4 shadow-sm shadow-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold">{category.name}</div>
            {category.type === "default" ? (
              <Badge variant="outline" className="h-5 px-2 text-[10px]">
                Default
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Terpakai {formatIDR(spent)} · Budget {formatIDR(category.budget)}
          </div>
          {category.budget > 0 ? (
            <div className="mt-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {Math.round(ratio * 100)}%
              </span>{" "}
              terpakai
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {category.type === "custom" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onEdit}
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <Progress value={percent} indicatorClassName={status.indicatorClassName} />
      {category.budget > 0 && ratio >= 0.7 ? (
        <div
          className={
            ratio > 1
              ? "text-sm text-rose-600"
              : "text-sm text-amber-700 dark:text-amber-300"
          }
        >
          {ratio > 1
            ? `Wah, ini udah lewat budget. Terpakai ${formatIDR(spent)} dari ${formatIDR(
                category.budget
              )}.`
            : `Budget kategori ini hampir habis. Terpakai ${formatIDR(spent)} dari ${formatIDR(
                category.budget
              )}.`}
        </div>
      ) : null}

      <div className="grid grid-cols-[1fr,140px] items-center gap-3">
        <Label className="text-xs text-muted-foreground">Budget bulanan</Label>
        <Input
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          value={category.budget}
          onChange={(e) => onBudgetChange(Number(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const categories = useOkaneStore((s: OkaneState) => s.categories);
  const addCategory = useOkaneStore((s: OkaneState) => s.addCategory);
  const updateCategory = useOkaneStore((s: OkaneState) => s.updateCategory);
  const deleteCategory = useOkaneStore((s: OkaneState) => s.deleteCategory);
  const transactions = useAppStore((s) => s.transactions);

  const monthIso = new Date().toISOString();
  const spentByCategory = useMemo(
    () => {
      const totals: Record<string, number> = {};
      for (const tx of transactions) {
        if (tx.amount >= 0) continue;
        if (!isSameMonth(tx.date, monthIso)) continue;
        const spent = Math.abs(tx.amount);
        totals[tx.category] = (totals[tx.category] ?? 0) + spent;
      }
      return totals;
    },
    [transactions, monthIso]
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const categoryForm = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "", budget: 0 }
  });

  const totalBudget = categories.reduce((sum, c) => sum + (c.budget ?? 0), 0);
  const spentTotal = categories.reduce(
    (sum, c) => sum + (spentByCategory[c.name] ?? 0),
    0
  );
  const totalRatio = totalBudget > 0 ? spentTotal / totalBudget : 0;
  const totalPercent = totalBudget > 0 ? Math.round(totalRatio * 100) : 0;
  const totalStatus =
    totalBudget === 0
      ? null
      : totalRatio > 1
        ? { label: "Melebihi budget", variant: "destructive" as const }
        : totalRatio >= 0.7
          ? { label: "Hampir habis", variant: "warning" as const }
          : { label: "Aman", variant: "success" as const };

  const openCreate = () => {
    setEditing(null);
    categoryForm.reset({ name: "", budget: 0 });
    setOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    categoryForm.reset({ name: category.name, budget: category.budget });
    setOpen(true);
  };

  const onSubmitCategory = (values: z.infer<typeof categoryFormSchema>) => {
    const name = values.name.trim();
    const budget = Math.max(0, Number(values.budget) || 0);
    if (editing) updateCategory(editing.id, { name, budget });
    else addCategory({ name, budget });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Plan</CardTitle>
        <CardDescription>Atur budget bulanan untuk kategori Kakeibo.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span className="ml-2">Tambah kategori</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-5 rounded-2xl border bg-background p-4 shadow-sm shadow-black/5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">Bulan ini</div>
            {totalStatus ? (
              <Badge variant={totalStatus.variant}>{totalStatus.label}</Badge>
            ) : (
              <Badge variant="outline">Belum diset</Badge>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div className="text-sm font-semibold">Total budget</div>
            <div className="text-sm font-semibold tabular-nums">{formatIDR(totalBudget)}</div>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <div className="text-sm text-muted-foreground">Terpakai</div>
            <div className="text-sm tabular-nums">{formatIDR(spentTotal)}</div>
          </div>
          {totalBudget > 0 ? (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{totalPercent}%</span>{" "}
              digunakan
            </div>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">
              Isi plan budget untuk dapat status dan insight.
            </div>
          )}
        </div>

        <div className="space-y-4">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              spent={spentByCategory[c.name] ?? 0}
              onEdit={() => openEdit(c)}
              onDelete={() => {
                const ok = window.confirm(`Hapus kategori "${c.name}"?`);
                if (ok) deleteCategory(c.id);
              }}
              onBudgetChange={(next) => updateCategory(c.id, { budget: Math.max(0, next) })}
            />
          ))}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit kategori" : "Tambah kategori"}</DialogTitle>
            <DialogDescription>
              Buat kategori yang sesuai kebiasaanmu. Okane akan menghitung status secara otomatis.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={categoryForm.handleSubmit(onSubmitCategory)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nama kategori</Label>
              <Input id="category-name" placeholder="Contoh: Transport" {...categoryForm.register("name")} />
              {categoryForm.formState.errors.name ? (
                <div className="text-xs text-rose-600">Masukkan nama kategori.</div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-budget">Budget bulanan</Label>
              <Controller
                control={categoryForm.control}
                name="budget"
                render={({ field }) => (
                  <Input
                    id="category-budget"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                )}
              />
              <div className="text-xs text-muted-foreground">
                Budget: {formatIDR(Number(categoryForm.watch("budget") || 0))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit">{editing ? "Simpan" : "Tambah"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
