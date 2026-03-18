import type { HabitState } from "@/stores/okane-store";

export type WeeklyReport = {
  totalExpense: number;
  totalIncome: number;
  totalTransactions: number;
  topCategory: { name: string; amount: number } | null;
  comparison: "up" | "down" | "flat";
  percentage: number;
  streak: number;
  insight: { title: string; description: string };
  period: string;
};

type Tx = { amount: number; category: string; date: string };

function ymdUtc(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function parseYmdUtc(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addDaysYmdUtc(ymd: string, days: number) {
  const d = parseYmdUtc(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatPeriod(nowIso: string) {
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

  if (startMonth === endMonth) return `${startDay}–${endDay} ${endMonth}`;
  return `${startDay} ${startMonth}–${endDay} ${endMonth}`;
}

function pickWeeklyInsight(input: {
  reflection?: string | null;
  coffeeCount: number;
  topCategory: { name: string; amount: number } | null;
  habit: HabitState;
  consistencyDays: number;
}) {
  const reflection = (input.reflection ?? "").toLowerCase().trim();
  const wantsToSave = reflection.includes("hemat") || reflection.includes("irit") || reflection.includes("nabung");
  const mentionsCoffee = reflection.includes("kopi") || reflection.includes("coffee");

  if (reflection) {
    if (wantsToSave) {
      return {
        title: "💡 Fokus hemat kamu kebaca",
        description: "Pilih 1 kebiasaan kecil yang paling gampang kamu rem minggu ini, biar konsisten dulu."
      };
    }
    if (mentionsCoffee) {
      return {
        title: "☕ Tentang kopi",
        description: "Kamu sempat mention kopi di refleksi. Kalau mau, coba pasang batas 2x/minggu."
      };
    }
    return {
      title: "🧠 Dari refleksi kamu",
      description: "Nice. Simpan satu komitmen kecil minggu depan, lalu ukur dari transaksi harianmu."
    };
  }

  if (input.coffeeCount >= 3) {
    return {
      title: "☕ Kopi sering muncul",
      description: "Kelihatan kopi sering kebeli minggu ini. Coba cut 1 kali dulu, nggak perlu langsung ekstrem."
    };
  }

  if (input.topCategory) {
    return {
      title: "📌 Fokus pos terbesar",
      description: `Pengeluaran terbesar kamu minggu ini ada di ${input.topCategory.name}. Kalau mau efektif, rapihin yang ini dulu.`
    };
  }

  if (input.habit.streak >= 5) {
    return {
      title: "🔥 Kamu lagi on fire",
      description: "Konsistensi kamu udah kebentuk. Pertahankan, cukup 1 transaksi per hari juga oke."
    };
  }

  if (input.consistencyDays <= 2) {
    return {
      title: "📊 Naikin konsistensi dikit",
      description: "Coba catat minimal 1 transaksi per hari biar weekly report kamu makin akurat."
    };
  }

  return {
    title: "✅ Week check",
    description: "Kita lanjut pelan-pelan. Minggu depan fokus 1 hal dulu biar terasa progress-nya."
  };
}

export function generateWeeklyReport(input: {
  transactions: Tx[];
  lastWeekTransactions: Tx[];
  reflection?: string | null;
  habit: HabitState;
  nowIso?: string;
}): WeeklyReport {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const period = formatPeriod(nowIso);

  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory: Record<string, number> = {};
  let coffeeCount = 0;
  for (const t of input.transactions) {
    if (t.amount >= 0) {
      totalIncome += t.amount;
      continue;
    }
    const abs = Math.abs(t.amount);
    totalExpense += abs;
    expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + abs;
    const c = t.category.toLowerCase();
    if (c.includes("kopi") || c.includes("coffee") || c.includes("cafe") || c.includes("kafe")) coffeeCount += 1;
  }

  const top = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];
  const topCategory = top ? { name: top[0], amount: top[1] } : null;

  let lastWeekExpense = 0;
  for (const t of input.lastWeekTransactions) {
    if (t.amount >= 0) continue;
    lastWeekExpense += Math.abs(t.amount);
  }

  const diff = totalExpense - lastWeekExpense;
  const comparison: WeeklyReport["comparison"] =
    diff === 0 ? "flat" : diff > 0 ? "up" : "down";
  const percentage =
    lastWeekExpense === 0
      ? totalExpense === 0
        ? 0
        : 100
      : Math.round((Math.abs(diff) / lastWeekExpense) * 100);

  const nowYmd = ymdUtc(nowIso);
  const last7Days = [
    nowYmd,
    addDaysYmdUtc(nowYmd, -1),
    addDaysYmdUtc(nowYmd, -2),
    addDaysYmdUtc(nowYmd, -3),
    addDaysYmdUtc(nowYmd, -4),
    addDaysYmdUtc(nowYmd, -5),
    addDaysYmdUtc(nowYmd, -6)
  ];
  const activeSet = new Set(input.habit.activeDays);
  let consistencyDays = 0;
  for (const d of last7Days) if (activeSet.has(d)) consistencyDays += 1;

  const insight = pickWeeklyInsight({
    reflection: input.reflection,
    coffeeCount,
    topCategory,
    habit: input.habit,
    consistencyDays
  });

  return {
    totalExpense,
    totalIncome,
    totalTransactions: input.transactions.length,
    topCategory,
    comparison,
    percentage,
    streak: input.habit.streak,
    insight,
    period
  };
}

