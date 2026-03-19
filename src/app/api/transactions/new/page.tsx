"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createId, formatIDR, KAKEIBO_CATEGORIES } from "@/lib/okane";
import type { TransactionType } from "@/lib/types";
import { useOkaneStore, type OkaneState } from "@/stores/okane-store";
import { useAppStore } from "@/store/okane-store";
import { Controller, useForm } from "react-hook-form";

const INCOME_CATEGORIES = ["Salary", "Bonus", "Other"] as const;

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

const formSchema = z.object({
  amount: z.number().int().positive(),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1),
  note: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function NewTransactionPage() {
  const router = useRouter();
  const addAppTransaction = useAppStore((s) => s.addTransaction);
  const setToast = useOkaneStore((s: OkaneState) => s.setToast);
  const categories = useOkaneStore((s: OkaneState) => s.categories);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      type: "expense",
      category: KAKEIBO_CATEGORIES[0],
      note: ""
    }
  });

  const type = form.watch("type");
  const categoryOptions = useMemo<string[]>(() => {
    const expense = categories.length ? categories.map((c) => c.name) : [...KAKEIBO_CATEGORIES];
    return type === "income" ? [...INCOME_CATEGORIES] : expense;
  }, [categories, type]);

  useEffect(() => {
    const current = form.getValues("category");
    if (!categoryOptions.includes(current)) {
      form.setValue("category", categoryOptions[0], { shouldValidate: true });
    }
  }, [categoryOptions, form]);

  const onSubmit = async (values: FormValues) => {
    const signedAmount = values.type === "expense" ? -values.amount : values.amount;
    const ok = await addAppTransaction({
      id: createId(),
      amount: signedAmount,
      category: values.category,
      date: new Date().toISOString()
    });
    if (!ok) {
      setToast({
        title: "Gagal menyimpan transaksi",
        message: "Silakan coba lagi. Jika masih gagal, login ulang."
      });
      return;
    }

    setToast({
      title: "Sip, transaksi tersimpan",
      message: `${formatIDR(values.amount)} · ${values.category}`
    });
    router.push("/dashboard");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah transaksi</CardTitle>
        <CardDescription>
          Catat cepat. Fokus di angka, sisanya optional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label>Tipe</Label>
            <Tabs
              value={type}
              onValueChange={(v: string) => form.setValue("type", v as TransactionType)}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="expense">Expense</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Nominal</Label>
            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => (
                <Input
                  id="amount"
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="done"
                  placeholder="Rp 0"
                  autoFocus
                  className="h-14 text-2xl font-semibold tabular-nums"
                  value={field.value > 0 ? formatIDR(field.value) : ""}
                  onChange={(e) => field.onChange(Number(digitsOnly(e.target.value) || "0"))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
            <div className="text-xs text-muted-foreground">
              Masukkan nominal dalam Rupiah (contoh: 10000 = Rp 10.000)
            </div>
            {form.formState.errors.amount ? (
              <div className="text-xs text-rose-600">Masukkan nominal yang valid.</div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(v: string) =>
                form.setValue("category", v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c: string) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.category ? (
              <div className="text-xs text-rose-600">Pilih kategori.</div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Input
              id="note"
              placeholder="contoh: belanja mingguan"
              {...form.register("note")}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
            >
              Batal
            </Button>
            <Button type="submit" className="flex-1">
              Simpan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
