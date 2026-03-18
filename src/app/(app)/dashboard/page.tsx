"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { generateCoachInsights } from "@/lib/ai-coach";
import { WeeklyReportCard, WeeklyReportEmptyCard } from "@/components/weekly-report-card";
import { cn } from "@/lib/utils";
import { formatIDR, getMonthlyExpensesByCategory, sortByNewest } from "@/lib/okane";
import type { Transaction as OkaneTransaction } from "@/lib/types";
import { generateWeeklyReport } from "@/lib/weekly-report";
import { useOkaneStore, type OkaneState } from "@/stores/okane-store";
import { useAppStore, type Transaction as AppTransaction } from "@/store/okane-store";

function toOkaneTransactions(input: AppTransaction[]): OkaneTransaction[] {
  return input.map((tx) => {
    const isIncome = tx.amount >= 0;
    const abs = Math.abs(tx.amount);
    return {
      id: tx.id,
      amount: abs,
      type: isIncome ? "income" : "expense",
      category: tx.category,
      date: tx.date
    };
  });
}

function SavingsTracker({ transactions }: { transactions: AppTransaction[] }) {
  const nowIso = new Date().toISOString();
  const now = new Date(nowIso);
  const from = new Date(now);
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  const fromMs = from.getTime();
  const toMs = now.getTime();

  let net = 0;
  for (const tx of transactions) {
    const ms = new Date(tx.date).getTime();
    if (ms < fromMs || ms > toMs) continue;
    net += tx.amount;
  }

  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm shadow-black/5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Savings Tracker</div>
        <Badge variant={net >= 0 ? "success" : "warning"}>{net >= 0 ? "On track" : "Perlu rapihin"}</Badge>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">Saldo bersih 7 hari terakhir</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", net >= 0 ? "text-emerald-600" : "text-rose-600")}>
        {formatIDR(net)}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Ini masih simulasi. Nanti kamu bisa set target tabungan dan lihat progresnya.
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: OkaneTransaction }) {
  const isIncome = tx.type === "income";
  const amount = isIncome ? tx.amount : -tx.amount;
  const amountClass = isIncome ? "text-emerald-600" : "text-rose-600";

  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium">{tx.category}</div>
          <Badge variant="outline" className="shrink-0">
            {tx.type}
          </Badge>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {tx.note ? tx.note : "—"} · {new Date(tx.date).toLocaleDateString("id-ID")}
        </div>
      </div>
      <div className={cn("text-sm font-semibold tabular-nums", amountClass)}>
        {formatIDR(amount)}
      </div>
    </div>
  );
}

function lastNDaysKeysUTC(nowIso: string, n: number) {
  const now = new Date(nowIso);
  const keys: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    d.setUTCHours(0, 0, 0, 0);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

function formatWeeklyPeriod(nowIso: string) {
  const end = new Date(nowIso);
  const start = new Date(nowIso);
  start.setUTCDate(start.getUTCDate() - 6);
  start.setUTCHours(0, 0, 0, 0);

  const fmtMonth = new Intl.DateTimeFormat("id-ID", { month: "short" });
  const fmtDay = new Intl.DateTimeFormat("id-ID", { day: "2-digit" });

  const startDay = fmtDay.format(start);
  const endDay = fmtDay.format(end);
  const startMonth = fmtMonth.format(start);
  const endMonth = fmtMonth.format(end);

  if (startMonth === endMonth) return `${startDay}–${endDay} ${startMonth}`;
  return `${startDay} ${startMonth}–${endDay} ${endMonth}`;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const appTransactions = useAppStore((s) => s.transactions);
  const appProgress = useAppStore((s) => s.userProgress);
  const latestReflection = useAppStore((s) => s.latestReflection);
  const habit = useAppStore((s) => s.habit);
  const getConsistency = useAppStore((s) => s.getConsistency);
  const categories = useOkaneStore((s: OkaneState) => s.categories);

  const transactions = toOkaneTransactions(appTransactions);
  const daysActive = appProgress.transactionDates.length;
  const progressPercent = Math.min(100, Math.round((daysActive / 5) * 100));
  const isConsistent = appProgress.isConsistent;
  const unlocked = appProgress.unlockedFeatures;
  const hasSavings = unlocked.includes("savings");

  const monthIso = new Date().toISOString();
  const now = new Date(monthIso);

  let monthIncome = 0;
  let monthExpense = 0;
  for (const tx of transactions) {
    const d = new Date(tx.date);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) continue;
    if (tx.type === "income") monthIncome += tx.amount;
    else monthExpense += tx.amount;
  }

  const monthBalance = monthIncome - monthExpense;
  const tone =
    monthBalance >= 0
      ? {
          label: "Tenang",
          variant: "success" as const,
          detail: "Bulan ini masih surplus. Tetap konsisten."
        }
      : {
          label: "Waspada",
          variant: "destructive" as const,
          detail: "Bulan ini defisit. Coba rapikan pengeluaran kecil."
        };

  const totalBudget = categories.reduce((sum, c) => sum + (c.budget ?? 0), 0);
  const remainingBudget = totalBudget - monthExpense;
  const recent = sortByNewest(transactions).slice(0, 5);

  const monthlyByCategory = getMonthlyExpensesByCategory(transactions, monthIso);
  const topCategory = Object.entries(monthlyByCategory).sort((a, b) => b[1] - a[1])[0];

  const budgetUsageRatio = totalBudget > 0 ? monthExpense / totalBudget : 0;
  const budgetUsagePercent = totalBudget > 0 ? Math.round(budgetUsageRatio * 100) : 0;
  const budgetUsageStatus =
    totalBudget === 0
      ? null
      : budgetUsageRatio > 1
        ? { label: "Melebihi budget", variant: "destructive" as const, indicator: "bg-rose-600" }
        : budgetUsageRatio >= 0.7
          ? { label: "Hampir habis", variant: "warning" as const, indicator: "bg-amber-500" }
          : { label: "Aman", variant: "success" as const, indicator: "bg-emerald-600" };

  const consistencyLabel = getConsistency();
  const last7 = lastNDaysKeysUTC(new Date().toISOString(), 7);
  const activeSet = new Set(habit.activeDays);
  let consistencyDays = 0;
  for (const d of last7) if (activeSet.has(d)) consistencyDays += 1;
  const consistencyPercent = Math.round((consistencyDays / 7) * 100);

  const coachInsights = generateCoachInsights({
    transactions: appTransactions,
    reflection: latestReflection?.text ?? null,
    habit
  });
  const name = session?.user?.name?.trim() || session?.user?.email?.trim() || "Kamu";

  const nowIso = new Date().toISOString();
  const weeklyPeriod = formatWeeklyPeriod(nowIso);
  const last14 = lastNDaysKeysUTC(nowIso, 14);
  const thisWeekSet = new Set(last14.slice(0, 7));
  const lastWeekSet = new Set(last14.slice(7, 14));
  const thisWeekTransactions = appTransactions.filter((t) =>
    thisWeekSet.has(new Date(t.date).toISOString().slice(0, 10))
  );
  const lastWeekTransactions = appTransactions.filter((t) =>
    lastWeekSet.has(new Date(t.date).toISOString().slice(0, 10))
  );
  const weeklyReport =
    thisWeekTransactions.length >= 3
      ? generateWeeklyReport({
          transactions: thisWeekTransactions,
          lastWeekTransactions,
          reflection: latestReflection?.text ?? null,
          habit,
          nowIso
        })
      : null;

  return (
    <div className="space-y-5">
      <Card className="border-transparent bg-gradient-to-b from-background to-muted/30 shadow-md shadow-black/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm text-muted-foreground">Saldo bulan ini</CardTitle>
            <Badge variant={tone.variant}>{tone.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-semibold tracking-tight tabular-nums">
            {formatIDR(monthBalance)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{tone.detail}</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
              <div className="text-xs text-muted-foreground">Income</div>
              <div className="mt-1 text-base font-semibold tabular-nums text-emerald-600">
                {formatIDR(monthIncome)}
              </div>
            </div>
            <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
              <div className="text-xs text-muted-foreground">Expense</div>
              <div className="mt-1 text-base font-semibold tabular-nums text-rose-600">
                {formatIDR(monthExpense)}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">Sisa budget bulan ini</div>
              <Badge variant={remainingBudget < 0 ? "destructive" : "success"}>
                {remainingBudget < 0 ? "Over" : "Aman"}
              </Badge>
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums">
              {formatIDR(remainingBudget)}
            </div>
            {topCategory ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Pengeluaran terbesar: {topCategory[0]} · {formatIDR(topCategory[1])}
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                Belum ada pengeluaran bulan ini.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {weeklyReport ? <WeeklyReportCard report={weeklyReport} /> : <WeeklyReportEmptyCard period={weeklyPeriod} />}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">🔥 Streak kamu</div>
            <div className="flex items-center gap-1">
              {habit.streak >= 7 ? <Badge variant="success">7 hari</Badge> : null}
              {habit.streak >= 3 ? <Badge variant="outline">3 hari</Badge> : null}
            </div>
          </div>
          {habit.streak > 0 ? (
            <div className="mt-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{habit.streak}</span>{" "}
              hari berturut-turut
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Mulai streak hari ini 🚀</div>
          )}
          <div className="mt-3">
            <Progress
              value={Math.min(100, Math.round((habit.streak / 7) * 100))}
              indicatorClassName={habit.streak >= 5 ? "bg-emerald-600" : "bg-amber-500"}
            />
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">📊 Konsistensi</div>
            <Badge variant={consistencyDays >= 5 ? "success" : "outline"}>{consistencyLabel}</Badge>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{consistencyDays}</span> dari{" "}
            <span className="font-semibold text-foreground tabular-nums">7</span> hari terakhir
          </div>
          <div className="mt-3">
            <Progress
              value={Math.min(100, consistencyPercent)}
              indicatorClassName={consistencyDays >= 5 ? "bg-emerald-600" : "bg-amber-500"}
            />
          </div>
        </div>
      </div>

      <Card className="bg-background/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Insight</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl border bg-background p-4 shadow-sm shadow-black/5">
            <div className="text-sm font-semibold">Halo {name}, ini insight kamu hari ini</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Berdasarkan 7 hari terakhir, refleksi, dan kebiasaanmu.
            </div>
          </div>

          <div className="rounded-2xl border bg-background p-4 shadow-sm shadow-black/5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Progress unlock</div>
              <Badge variant={isConsistent ? "success" : "outline"}>
                {isConsistent ? "Unlocked" : "Locked"}
              </Badge>
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              Progress:{" "}
              <span className="font-semibold text-foreground tabular-nums">{Math.min(5, daysActive)}/5</span>{" "}
              hari
            </div>
            <div className="mt-3">
              <Progress value={progressPercent} indicatorClassName={isConsistent ? "bg-emerald-600" : "bg-amber-500"} />
            </div>

            {!isConsistent ? (
              <div className="mt-3 text-sm text-muted-foreground">
                Catat transaksi 5 dari 7 hari untuk membuka fitur lanjutan
              </div>
            ) : (
              <div className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                Insight terbuka 🎉 Kamu sudah konsisten!
              </div>
            )}

            <div className="mt-2 text-xs text-muted-foreground">
              Gabungkan transaksi + refleksi untuk insight yang lebih akurat
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                Fitur aktif: {unlocked.filter((f) => f !== "core").length ? unlocked.filter((f) => f !== "core").join(", ") : "core"}
              </div>
            </div>
          </div>

          {hasSavings ? <SavingsTracker transactions={appTransactions} /> : null}

          {coachInsights.map((i) => (
            <div key={i.title} className="rounded-2xl border bg-background p-4 shadow-sm shadow-black/5">
              <div className="text-sm font-semibold">{i.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{i.description}</div>
            </div>
          ))}

          {totalBudget > 0 ? (
            <div className="rounded-2xl border bg-background p-4 shadow-sm shadow-black/5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Pemakaian budget</div>
                {budgetUsageStatus ? (
                  <Badge variant={budgetUsageStatus.variant}>{budgetUsageStatus.label}</Badge>
                ) : (
                  <Badge variant="outline">Belum diset</Badge>
                )}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Kamu sudah menggunakan{" "}
                <span className="font-semibold text-foreground tabular-nums">{budgetUsagePercent}%</span>{" "}
                budget bulan ini
              </div>
              <div className="mt-3">
                <Progress
                  value={Math.min(100, budgetUsagePercent)}
                  indicatorClassName={budgetUsageStatus?.indicator}
                />
              </div>
            </div>
          ) : (
            <Button asChild variant="outline" className="w-full">
              <Link href="/budget">Buat plan budget</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="bg-background/60">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm text-muted-foreground">Transaksi terbaru</CardTitle>
          <Link
            href="/transactions/new"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Tambah <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="py-10 text-center">
              <div className="text-base font-semibold tracking-tight">
                Mulai catat pengeluaran pertamamu hari ini
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Cukup isi nominal, pilih kategori, lalu simpan.
              </div>
              <Button asChild className="mt-4 w-full">
                <Link href="/transactions/new">Tambah transaksi</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        asChild
        size="icon"
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-xl shadow-black/10"
      >
        <Link href="/transactions/new" aria-label="Add transaction">
          <Plus className="h-5 w-5" />
        </Link>
      </Button>
    </div>
  );
}
