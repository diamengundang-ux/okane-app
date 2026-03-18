import type { Category, Insight, KakeiboCategory, Reflection, Transaction } from "@/lib/types";

export const KAKEIBO_CATEGORIES: KakeiboCategory[] = [
  "Needs",
  "Wants",
  "Culture",
  "Unexpected"
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "needs", name: "Needs", budget: 0, type: "default" },
  { id: "wants", name: "Wants", budget: 0, type: "default" },
  { id: "culture", name: "Culture", budget: 0, type: "default" },
  { id: "unexpected", name: "Unexpected", budget: 0, type: "default" }
];

export function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function isSameMonth(isoA: string, isoB: string) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function sortByNewest<T extends { date: string }>(items: T[]) {
  return [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getTotals(transactions: Transaction[]) {
  let income = 0;
  let expense = 0;

  for (const tx of transactions) {
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }

  return {
    income,
    expense,
    balance: income - expense
  };
}

export function getMonthlyExpensesByCategory(
  transactions: Transaction[],
  monthIso: string
) {
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    if (!isSameMonth(tx.date, monthIso)) continue;
    totals[tx.category] = (totals[tx.category] ?? 0) + tx.amount;
  }
  return totals;
}

export function getHabitMessage(streak: number, consistencyDays: number) {
  if (streak >= 5) return "🔥 Kamu lagi on fire! Pertahankan!";
  if (streak >= 2) return "👍 Bagus, lanjutkan konsistensimu!";
  if (streak === 1) return "🚀 Good start! Besok lanjut ya";
  if (consistencyDays <= 2) return "Coba catat minimal 1 transaksi per hari";
  return "Mulai streak hari ini 🚀";
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(date: Date) {
  return startOfWeekMonday(date).toISOString().slice(0, 10);
}

function sumExpenses(transactions: Transaction[], from: Date, to: Date) {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  let total = 0;
  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    const ms = new Date(tx.date).getTime();
    if (ms < fromMs || ms > toMs) continue;
    total += tx.amount;
  }
  return total;
}

function pickEmojiForCategory(name: string) {
  const n = name.toLowerCase();
  if (n.includes("kopi") || n.includes("coffee") || n.includes("cafe")) return "☕";
  if (n.includes("makan") || n.includes("food") || n.includes("kuliner")) return "🍜";
  if (n.includes("transport") || n.includes("ojek") || n.includes("grab") || n.includes("gojek"))
    return "🛵";
  if (n.includes("belanja") || n.includes("shopping")) return "🛍️";
  return "💸";
}

export function generateInsights(input: {
  nowIso: string;
  transactions: Transaction[];
  categories: Category[];
  reflections: Reflection[];
  latestReflectionText?: string;
}) {
  const now = new Date(input.nowIso);
  const monthIso = now.toISOString();

  const categories = input.categories;
  const totalBudget = categories.reduce((sum, c) => sum + (c.budget ?? 0), 0);

  let monthExpense = 0;
  let monthIncome = 0;
  for (const tx of input.transactions) {
    if (!isSameMonth(tx.date, monthIso)) continue;
    if (tx.type === "expense") monthExpense += tx.amount;
    else monthIncome += tx.amount;
  }

  const reflectionText = input.latestReflectionText?.toLowerCase().trim();
  const insights: Insight[] = [];

  const summary: Insight = (() => {
    const balance = monthIncome - monthExpense;
    if (totalBudget > 0) {
      const ratio = monthExpense / totalBudget;
      if (ratio <= 0.7) {
        return {
          id: `summary_ok_${monthIso.slice(0, 7)}`,
          kind: "weekly_summary" as const,
          tone: "positive" as const,
          title: "Keuangan kamu stabil 👍",
          message: `Pemakaian budget masih aman. Saldo bulan ini ${formatIDR(balance)} — pertahankan ritmenya ya.`
        };
      }
      if (ratio <= 1) {
        return {
          id: `summary_tight_${monthIso.slice(0, 7)}`,
          kind: "weekly_summary" as const,
          tone: "neutral" as const,
          title: "Budget mulai ketat 🙂",
          message: `Kamu udah dekat batas budget bulan ini. Pelan-pelan rapihin pos kecil biar tetap aman.`
        };
      }
      return {
        id: `summary_over_${monthIso.slice(0, 7)}`,
        kind: "weekly_summary" as const,
        tone: "warning" as const,
        title: "Budget kamu kebablasan ⚠️",
        message: `Tenang, ini bisa dibenerin. Coba pilih 1 kategori yang paling bocor minggu ini dan rem sedikit.`
      };
    }

    if (balance >= 0) {
      return {
        id: `summary_balance_ok_${monthIso.slice(0, 7)}`,
        kind: "weekly_summary" as const,
        tone: "positive" as const,
        title: "Keuangan kamu stabil 👍",
        message: `Saldo bulan ini ${formatIDR(balance)}. Kalau mau lebih rapi, isi Plan biar ada batasan per kategori.`
      };
    }

    return {
      id: `summary_balance_warn_${monthIso.slice(0, 7)}`,
      kind: "weekly_summary" as const,
      tone: "warning" as const,
      title: "Pengeluaran lagi besar ⚠️",
      message: `Saldo bulan ini ${formatIDR(balance)}. Coba cek 1–2 pengeluaran kecil yang sering kebablasan ya.`
    };
  })();

  const currentWeekStart = startOfWeekMonday(now);
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
  currentWeekEnd.setMilliseconds(currentWeekEnd.getMilliseconds() - 1);

  const thisWeekExpense = sumExpenses(input.transactions, currentWeekStart, currentWeekEnd);
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(currentWeekEnd);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
  const lastWeekExpense = sumExpenses(input.transactions, lastWeekStart, lastWeekEnd);

  const warning: Insight | null = (() => {
    if (thisWeekExpense <= 0 || lastWeekExpense <= 0) return null;
    const deltaRatio = (thisWeekExpense - lastWeekExpense) / lastWeekExpense;
    if (deltaRatio <= 0.2) return null;
    return {
      id: `warn_weekly_spike_${weekKey(now)}`,
      kind: "spending_highlight" as const,
      tone: "warning" as const,
      title: "Pengeluaran mulai naik ⚠️",
      message: `Minggu ini ${formatIDR(thisWeekExpense)} (minggu lalu ${formatIDR(lastWeekExpense)}). Coba cek pengeluaran kecil yang sering “nggak kerasa”.`
    };
  })();

  const suggestion: Insight = (() => {
    if (reflectionText) {
      const hasAny = (keys: string[]) => keys.some((k) => reflectionText.includes(k));

      if (hasAny(["kopi", "coffee", "starbucks", "cafe"])) {
        return {
          id: `suggest_kopi_${weekKey(now)}`,
          kind: "spending_highlight",
          tone: "neutral",
          title: "Kamu sering jajan kopi ☕",
          message:
            "Kamu mention kopi/cafe — coba batasi 2x/minggu. Pilih 1 hari “bebas kopi” biar pelan-pelan kebentuk kebiasaannya.",
          source: "reflection"
        };
      }

      if (hasAny(["makan", "jajan", "kuliner", "food"])) {
        return {
          id: `suggest_makan_${weekKey(now)}`,
          kind: "spending_highlight",
          tone: "neutral",
          title: "Pola makan kamu lagi rame 🍜",
          message:
            "Gabungin 2 hal: pasang batas harian kecil (mis. Rp 30.000/hari) + tentukan 2 hari masak di rumah.",
          source: "reflection"
        };
      }

      if (hasAny(["boros", "kebablasan"])) {
        return {
          id: `suggest_boros_${weekKey(now)}`,
          kind: "spending_highlight",
          tone: "neutral",
          title: "Kamu ngerasa boros ya 🙂",
          message:
            "Ambil 1 kebocoran terbesar minggu ini. Pilih satu aturan simpel, mis. maksimal 1x jajan per hari.",
          source: "reflection"
        };
      }
    }

    const monthlyByCategory = getMonthlyExpensesByCategory(input.transactions, monthIso);
    const overused = categories
      .filter((c) => c.budget > 0)
      .map((c) => {
        const spent = monthlyByCategory[c.name] ?? 0;
        const ratio = spent / c.budget;
        return { category: c.name, ratio, spent, budget: c.budget };
      })
      .sort((a, b) => b.ratio - a.ratio)[0];

    if (overused && overused.ratio >= 0.7) {
      const emoji = pickEmojiForCategory(overused.category);
      return {
        id: `suggest_category_${overused.category}_${monthIso.slice(0, 7)}`,
        kind: "budget_warning",
        tone: "neutral",
        title: `Fokus tahan di ${overused.category} ${emoji}`,
        message: `Kategori ini lagi paling dominan bulan ini. Coba rem sedikit minggu ini, atau adjust budget biar realistis.`,
        source: "data"
      };
    }

    return {
      id: `suggest_habit_${weekKey(now)}`,
      kind: "reflection_reminder",
      tone: "neutral",
      title: "Tip kecil biar konsisten ⏰",
      message: "Coba catat transaksi 1 menit sebelum tidur. Sedikit tapi rutin = cepat kebentuk.",
      source: "data"
    };
  })();

  insights.push(summary);
  if (warning) insights.push(warning);
  insights.push(suggestion);

  return insights.slice(0, 3);
}
