"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIDR } from "@/lib/okane";
import type { WeeklyReport } from "@/lib/weekly-report";
import { cn } from "@/lib/utils";

export function WeeklyReportEmptyCard({ period }: { period: string }) {
  return (
    <Card className="bg-background/60">
      <CardHeader className="pb-3">
        <div className="min-w-0">
          <CardTitle className="text-sm text-muted-foreground">Weekly Report</CardTitle>
          <div className="mt-1 text-xs text-muted-foreground">{period}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground shadow-sm shadow-black/5">
          Belum cukup data untuk weekly report. Butuh minimal 3 transaksi dalam 7 hari terakhir.
        </div>
      </CardContent>
    </Card>
  );
}

export function WeeklyReportCard({ report }: { report: WeeklyReport }) {
  const badge = (() => {
    if (report.comparison === "up") {
      return { label: `Up ${report.percentage}%`, variant: "warning" as const, Icon: ArrowUpRight };
    }
    if (report.comparison === "down") {
      return { label: `Down ${report.percentage}%`, variant: "success" as const, Icon: ArrowDownRight };
    }
    return { label: "Flat", variant: "outline" as const, Icon: ArrowRight };
  })();
  const Icon = badge.Icon;

  return (
    <Card className="bg-background/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm text-muted-foreground">Weekly Report</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">{report.period}</div>
          </div>
          <Badge variant={badge.variant} className="shrink-0">
            <Icon className="mr-1 h-3.5 w-3.5" />
            {badge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
          <div className="text-xs text-muted-foreground">Total expense</div>
          <div className={cn("mt-1 text-2xl font-semibold tabular-nums", "text-rose-600")}>
            {formatIDR(report.totalExpense)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {report.totalTransactions} transaksi minggu ini
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
            <div className="text-xs text-muted-foreground">Top category</div>
            {report.topCategory ? (
              <>
                <div className="mt-1 truncate text-sm font-semibold">{report.topCategory.name}</div>
                <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {formatIDR(report.topCategory.amount)}
                </div>
              </>
            ) : (
              <div className="mt-1 text-sm font-semibold">—</div>
            )}
          </div>
          <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
            <div className="text-xs text-muted-foreground">Streak</div>
            {report.streak > 0 ? (
              <div className="mt-1 text-sm font-semibold tabular-nums">🔥 {report.streak} hari</div>
            ) : (
              <div className="mt-1 text-sm font-semibold">Mulai hari ini 🚀</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-4 shadow-sm shadow-black/5">
          <div className="text-sm font-semibold">{report.insight.title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{report.insight.description}</div>
        </div>
      </CardContent>
    </Card>
  );
}
