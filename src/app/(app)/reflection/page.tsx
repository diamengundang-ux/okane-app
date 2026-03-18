"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/Notice";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/okane-store";

const reflectionSchema = z.object({
  remaining: z.string().default(""),
  improve: z.string().default(""),
  reduce: z.string().default("")
});

type ReflectionFormValues = z.infer<typeof reflectionSchema>;

export default function ReflectionPage() {
  const progress = useAppStore((s) => s.userProgress);
  const setLatestReflection = useAppStore((s) => s.setLatestReflection);
  const loadInsightsFromApi = useAppStore((s) => s.loadInsightsFromApi);
  const toast = useToast();
  const showBeginnerHint = progress.transactionDates.length < 3;
  const [reflections, setReflections] = useState<
    Array<{ id: string; sisa: string; perbaikan: string; kurangi: string; combined_text: string; created_at: string }>
  >([]);

  const form = useForm<ReflectionFormValues>({
    resolver: zodResolver(reflectionSchema),
    defaultValues: {
      remaining: "",
      improve: "",
      reduce: ""
    }
  });

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/reflections", { cache: "no-store" });
        if (!res.ok) return;
        const rows = (await res.json()) as Array<{
          id: string;
          sisa: string;
          perbaikan: string;
          kurangi: string;
          combined_text: string;
          created_at: string;
        }>;
        if (!Array.isArray(rows)) return;
        setReflections(rows);
      } catch {
        return;
      }
    })();
  }, []);

  const onSubmit = async (values: ReflectionFormValues) => {
    const payload = {
      remaining: values.remaining?.trim() ?? "",
      improve: values.improve?.trim() ?? "",
      reduce: values.reduce?.trim() ?? ""
    };

    if (!payload.remaining && !payload.improve && !payload.reduce) {
      toast.error("Refleksi kosong", "Isi minimal satu bagian agar insight bisa diproses.");
      return;
    }

    try {
      const ok = await setLatestReflection(payload);
      if (!ok) {
        toast.error("Gagal menyimpan refleksi", "Cek koneksi dan coba lagi.");
      } else {
        toast.success("Refleksi berhasil disimpan");
        const res = await fetch("/api/reflections", { cache: "no-store" });
        if (res.ok) {
          const rows = (await res.json()) as Array<{
            id: string;
            sisa: string;
            perbaikan: string;
            kurangi: string;
            combined_text: string;
            created_at: string;
          }>;
          if (Array.isArray(rows)) setReflections(rows);
        }
      }
    } catch {
      toast.error("Gagal menyimpan refleksi", "Cek koneksi dan coba lagi.");
    }

    await loadInsightsFromApi();
    form.reset();
  };

  const recent = reflections.slice(0, 3);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Reflect</CardTitle>
          <CardDescription>
            Refleksi mingguan singkat untuk bantu kamu lebih sadar dengan uangmu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Notice
            type="info"
            description="Reflect membantu Okane memahami kebiasaanmu. Semakin sering kamu isi, insight akan lebih personal setelah terbuka."
            className="mb-4"
          />
          {showBeginnerHint ? (
            <Notice
              type="warning"
              description="Kamu belum punya banyak data. Catat transaksi dulu beberapa hari, lalu refleksi akan lebih akurat."
              className="mb-4"
            />
          ) : null}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label>Berapa uang tersisa?</Label>
              <div className="text-xs text-muted-foreground">
                Contoh: “Sisa Rp 450.000 sampai gajian, jadi harus hemat makan di luar.”
              </div>
              <Textarea
                placeholder="Tulis sisa uangmu minggu ini..."
                {...form.register("remaining")}
              />
              {form.formState.errors.remaining ? (
                <div className="text-xs text-rose-600">Wajib diisi.</div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Apa yang bisa diperbaiki?</Label>
              <div className="text-xs text-muted-foreground">
                Fokus ke 1–2 hal kecil yang realistis untuk minggu depan.
              </div>
              <Textarea
                placeholder="Contoh: “Catat pengeluaran harian sebelum tidur.”"
                {...form.register("improve")}
              />
              {form.formState.errors.improve ? (
                <div className="text-xs text-rose-600">Wajib diisi.</div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Apa yang harus dikurangi?</Label>
              <div className="text-xs text-muted-foreground">
                Pilih satu kebiasaan yang paling “bocor” minggu ini.
              </div>
              <Textarea
                placeholder="Contoh: “Kurangi jajan kopi jadi 2x seminggu.”"
                {...form.register("reduce")}
              />
              {form.formState.errors.reduce ? (
                <div className="text-xs text-rose-600">Wajib diisi.</div>
              ) : null}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
              aria-busy={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Menyimpan..." : "Simpan refleksi"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Refleksi terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Belum ada refleksi.
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((r) => (
                <div key={r.id} className="rounded-2xl border bg-background p-4 shadow-sm shadow-black/5">
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toISOString().slice(0, 10)}</div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Berapa uang tersisa?
                      </div>
                      <div className="whitespace-pre-wrap">{r.sisa}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Apa yang bisa diperbaiki?
                      </div>
                      <div className="whitespace-pre-wrap">{r.perbaikan}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Apa yang harus dikurangi?
                      </div>
                      <div className="whitespace-pre-wrap">{r.kurangi}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
