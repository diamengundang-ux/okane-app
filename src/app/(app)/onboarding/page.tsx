"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PiggyBank, Receipt, Target, WalletCards } from "lucide-react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/okane";

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

function stripRupiahPrefix(value: string) {
  return value.replace(/^Rp\s?/i, "").trim();
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const active = i + 1 === current;
        return (
          <span
            key={i}
            className={cn(
              "h-1.5 w-5 rounded-full transition-colors",
              active ? "bg-foreground" : "bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}

type GoalKey = "hemat_uang" | "nabung" | "tracking_pengeluaran";

type GoalOption = {
  key: GoalKey;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const GOALS: GoalOption[] = [
  {
    key: "hemat_uang",
    title: "Hemat uang",
    description: "Cari dan rem kebocoran kecil.",
    icon: Target
  },
  {
    key: "nabung",
    title: "Nabung",
    description: "Bikin ruang untuk tujuanmu.",
    icon: PiggyBank
  },
  {
    key: "tracking_pengeluaran",
    title: "Tracking pengeluaran",
    description: "Biar jelas larinya ke mana.",
    icon: Receipt
  }
];

export default function OnboardingPage() {
  const router = useRouter();
  const { status } = useSession();

  const [step, setStep] = useState(1);
  const [selectedGoal, setSelectedGoal] = useState<GoalKey | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") return;
    void (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          onboardingCompleted?: boolean;
          user?: { goal?: string; monthly_income?: number };
        };
        if (json.onboardingCompleted) {
          router.replace("/dashboard");
          return;
        }
        const goalRaw = typeof json.user?.goal === "string" ? json.user.goal : "";
        if (goalRaw === "hemat_uang" || goalRaw === "nabung" || goalRaw === "tracking_pengeluaran") {
          setSelectedGoal(goalRaw);
        }
        const incomeRaw = typeof json.user?.monthly_income === "number" ? json.user.monthly_income : 0;
        setMonthlyIncome(Number.isFinite(incomeRaw) ? incomeRaw : 0);
      } catch {
        return;
      }
    })();
  }, [router, status]);

  const formattedIncome = useMemo(() => {
    if (!monthlyIncome) return "";
    return stripRupiahPrefix(formatIDR(monthlyIncome));
  }, [monthlyIncome]);

  const totalSteps = 5;

  const canNext = (() => {
    if (step === 2) return Boolean(selectedGoal);
    if (step === 3) return monthlyIncome > 0;
    return true;
  })();

  const onBack = () => setStep((s) => Math.max(1, s - 1));

  const onNext = () => {
    setStep((s) => Math.min(totalSteps, s + 1));
  };

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <Card className="overflow-hidden bg-background/70 shadow-sm shadow-black/5">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {Math.min(step, totalSteps)} / {totalSteps}
            </div>
            <StepDots total={totalSteps} current={Math.min(step, totalSteps)} />
          </div>
          {step === 1 ? (
            <>
              <CardTitle className="text-2xl tracking-tight">Selamat datang di Okane</CardTitle>
              <CardDescription className="text-base">
                Mulai atur uangmu dengan cara sederhana
              </CardDescription>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <CardTitle className="text-xl tracking-tight">Apa fokus kamu sekarang?</CardTitle>
              <CardDescription>Pilih satu dulu, nanti bisa berubah.</CardDescription>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <CardTitle className="text-xl tracking-tight">Berapa pemasukan bulananmu?</CardTitle>
              <CardDescription>Perkiraan aja, biar Okane bisa bantu ngarahin.</CardDescription>
            </>
          ) : null}
          {step === 4 ? (
            <>
              <CardTitle className="text-xl tracking-tight">Kenalan dengan Kakeibo</CardTitle>
              <CardDescription>3 kategori simpel untuk mulai.</CardDescription>
            </>
          ) : null}
          {step === 5 ? (
            <>
              <CardTitle className="text-xl tracking-tight">Siap mulai?</CardTitle>
              <CardDescription>Yuk catat transaksi pertama.</CardDescription>
            </>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="min-h-[280px]">
            {step === 1 ? (
              <div className="grid place-items-center py-8 text-center animate-in fade-in">
                <div className="rounded-2xl border bg-background p-4 shadow-sm shadow-black/5">
                  <WalletCards className="mx-auto h-7 w-7 text-muted-foreground" />
                </div>
                <div className="mt-5 text-sm text-muted-foreground">
                  Catat, refleksi, lalu lihat insight yang makin personal.
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-3 animate-in fade-in">
                {GOALS.map((g) => {
                  const selected = selectedGoal === g.key;
                  const Icon = g.icon;
                  return (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setSelectedGoal(g.key)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border bg-background p-4 text-left shadow-sm shadow-black/5 transition-colors",
                        selected ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/30"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 rounded-lg border bg-background p-2",
                          selected ? "border-foreground/20" : "border-border"
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold tracking-tight">{g.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{g.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="animate-in fade-in">
                <div className="rounded-xl border bg-background shadow-sm shadow-black/5">
                  <div className="flex items-stretch">
                    <div className="flex items-center px-4 text-sm font-semibold text-muted-foreground">
                      Rp
                    </div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      enterKeyHint="done"
                      placeholder="0"
                      className="h-14 rounded-none border-0 px-3 text-2xl font-semibold tabular-nums focus-visible:ring-0"
                      value={formattedIncome}
                      onChange={(e) => setMonthlyIncome(Number(digitsOnly(e.target.value) || "0"))}
                    />
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Kamu bisa ubah ini nanti.
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-3 animate-in fade-in">
                <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
                  <div className="text-sm font-semibold tracking-tight">Needs</div>
                  <div className="mt-1 text-sm text-muted-foreground">Kebutuhan wajib sehari-hari.</div>
                </div>
                <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
                  <div className="text-sm font-semibold tracking-tight">Wants</div>
                  <div className="mt-1 text-sm text-muted-foreground">Keinginan, boleh tapi terukur.</div>
                </div>
                <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
                  <div className="text-sm font-semibold tracking-tight">Savings</div>
                  <div className="mt-1 text-sm text-muted-foreground">Tabungan untuk tujuan kamu.</div>
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="grid place-items-center gap-3 py-10 text-center animate-in fade-in">
                <div className="text-sm text-muted-foreground">
                  Yuk mulai catat transaksi pertama
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex gap-2">
            {step > 1 ? (
              <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
                Kembali
              </Button>
            ) : null}

            {step < totalSteps ? (
              <Button type="button" className="flex-1" onClick={step === 1 ? () => setStep(2) : onNext} disabled={!canNext}>
                {step === 1 ? "Mulai" : "Lanjut"}
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1"
                onClick={async () => {
                  if (saving) return;
                  setSaving(true);
                  try {
                    const res = await fetch("/api/onboarding", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ goal: selectedGoal ?? "", monthlyIncome })
                    });
                    if (res.ok) router.replace("/add");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? "Menyimpan..." : "Catat sekarang"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
