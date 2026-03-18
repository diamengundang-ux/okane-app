import { formatIDR } from "@/lib/okane";
import type { HabitState } from "@/stores/okane-store";

export type CoachInsight = {
  title: string;
  description: string;
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

function clampMax<T>(items: T[], max: number) {
  return items.length > max ? items.slice(0, max) : items;
}

export function generateCoachInsights(input: {
  transactions: Tx[];
  reflection?: string | null;
  habit: HabitState;
  nowIso?: string;
}) {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowYmd = ymdUtc(nowIso);
  const last7 = lastNDaysKeysUTC(nowIso, 7);
  const last7Set = new Set(last7);

  const tx7 = input.transactions.filter((t) => last7Set.has(ymdUtc(t.date)));

  const insights: CoachInsight[] = [];

  const activeSet = new Set(input.habit.activeDays);
  let consistencyDays = 0;
  for (const d of last7) if (activeSet.has(d)) consistencyDays += 1;

  const countsByDay: Record<string, number> = {};
  for (const t of tx7) {
    const day = ymdUtc(t.date);
    countsByDay[day] = (countsByDay[day] ?? 0) + 1;
  }

  let income = 0;
  let expense = 0;
  const expenseByCategory: Record<string, number> = {};
  for (const t of tx7) {
    if (t.amount >= 0) {
      income += t.amount;
      continue;
    }
    const abs = Math.abs(t.amount);
    expense += abs;
    expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + abs;
  }

  const topCategoryEntry = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topCategoryEntry ? { name: topCategoryEntry[0], amount: topCategoryEntry[1] } : null;

  const isCoffee = (category: string) => {
    const c = category.toLowerCase();
    return c.includes("kopi") || c.includes("coffee") || c.includes("cafe") || c.includes("kafe");
  };
  const coffeeCount = tx7.filter((t) => t.amount < 0 && isCoffee(t.category)).length;

  const expenseLast3 = (() => {
    const days = [nowYmd, addDaysYmdUtc(nowYmd, -1), addDaysYmdUtc(nowYmd, -2)];
    const set = new Set(days);
    let total = 0;
    for (const t of tx7) {
      if (t.amount >= 0) continue;
      if (!set.has(ymdUtc(t.date))) continue;
      total += Math.abs(t.amount);
    }
    return total;
  })();

  const expensePrev3 = (() => {
    const days = [addDaysYmdUtc(nowYmd, -3), addDaysYmdUtc(nowYmd, -4), addDaysYmdUtc(nowYmd, -5)];
    const set = new Set(days);
    let total = 0;
    for (const t of tx7) {
      if (t.amount >= 0) continue;
      if (!set.has(ymdUtc(t.date))) continue;
      total += Math.abs(t.amount);
    }
    return total;
  })();

  const trend = (() => {
    const prevAvg = expensePrev3 / 3;
    const lastAvg = expenseLast3 / 3;
    if (prevAvg === 0 && lastAvg === 0) return "flat" as const;
    if (prevAvg === 0 && lastAvg > 0) return "naik" as const;
    if (lastAvg > prevAvg * 1.15) return "naik" as const;
    if (lastAvg < prevAvg * 0.85) return "turun" as const;
    return "flat" as const;
  })();

  const reflection = (input.reflection ?? "").toLowerCase().trim();
  const wantsToSave = reflection.includes("hemat") || reflection.includes("irit") || reflection.includes("nabung");
  const mentionsCoffee = reflection.includes("kopi") || reflection.includes("coffee");
  const mentionsFood = reflection.includes("makan") || reflection.includes("jajan");

  if (tx7.length === 0) {
    insights.push({
      title: "🚀 Mulai dulu pelan-pelan",
      description: "Catat 1 transaksi hari ini aja. Besok kita rapihin bareng-bareng."
    });

    if (input.habit.streak >= 1) {
      insights.push({
        title: "🔥 Mantap, tetap lanjut",
        description: `Kamu sudah mulai kebiasaan baik. Streak kamu sekarang ${input.habit.streak} hari.`
      });
    }

    if (reflection) {
      insights.push({
        title: "💡 Aku ingat fokusmu",
        description: wantsToSave
          ? "Kamu lagi fokus hemat—bagus. Mulai dari 1 kebiasaan kecil yang konsisten dulu."
          : "Refleksi kamu kebaca. Yuk lengkapi dengan transaksi biar sarannya makin akurat."
      });
    }

    return clampMax(insights, 3);
  }

  if (expense > income && income > 0) {
    insights.push({
      title: "⚠️ Pengeluaran lebih besar dari pemasukan",
      description: `Minggu ini kamu keluar ${formatIDR(expense)} vs masuk ${formatIDR(income)}. Coba pilih 1 pos yang paling gampang direm dulu ya.`
    });
  }

  if (coffeeCount >= 2 || (mentionsCoffee && coffeeCount >= 1)) {
    insights.push({
      title: "☕ Kurangi kopi pelan-pelan",
      description:
        coffeeCount >= 3
          ? "Kamu sering jajan kopi minggu ini. Coba pasang batas 2x/minggu dan pilih 1 hari bebas kopi."
          : "Kopi muncul beberapa kali minggu ini. Kalau mau hemat, mulai dari cut 1 kali dulu."
    });
  }

  if (!coffeeCount && topCategory) {
    insights.push({
      title: "📌 Fokus di pos terbesar",
      description: `Pengeluaran terbesar kamu minggu ini ada di ${topCategory.name} (${formatIDR(topCategory.amount)}). Kalau mau efektif, mulai rapihin di sini dulu.`
    });
  }

  if (trend === "naik") {
    insights.push({
      title: "📈 Pengeluaran lagi naik",
      description: "3 hari terakhir lebih boros dibanding 3 hari sebelumnya. Coba cek pos kecil yang suka kebablasan."
    });
  } else if (trend === "turun") {
    insights.push({
      title: "📉 Nice, pengeluaran menurun",
      description: "3 hari terakhir lebih hemat dari sebelumnya. Pertahankan ritmenya ya."
    });
  }

  if (input.habit.streak >= 5) {
    insights.push({
      title: "🔥 Kamu lagi konsisten banget!",
      description: `Streak kamu ${input.habit.streak} hari. Ini kebiasaan yang bikin budgeting jadi gampang.`
    });
  } else if (input.habit.streak >= 2) {
    insights.push({
      title: "👍 Bagus, lanjutkan!",
      description: `Kamu sudah ${input.habit.streak} hari berturut-turut. Besok catat 1 transaksi aja juga cukup.`
    });
  } else if (input.habit.streak === 1) {
    insights.push({
      title: "🚀 Good start!",
      description: "Hari ini udah mulai. Besok lanjut ya—cukup 1 transaksi dulu."
    });
  }

  if (wantsToSave) {
    insights.push({
      title: "💡 Fokus hemat kamu kebaca",
      description: "Kamu lagi fokus hemat, bagus. Pilih 1 kebiasaan kecil (kopi/jajan/ongkir) buat direm minggu ini."
    });
  } else if (mentionsFood) {
    insights.push({
      title: "🍜 Soal makan/jajan",
      description: "Kalau ini yang paling sering bikin bocor, coba pasang batas harian kecil dulu biar tetap realistis."
    });
  }

  if (consistencyDays <= 2) {
    insights.push({
      title: "📊 Naikin konsistensi dikit",
      description: "Coba catat minimal 1 transaksi per hari biar pola pengeluaranmu kebaca jelas."
    });
  }

  const uniq: CoachInsight[] = [];
  const seen = new Set<string>();
  for (const i of insights) {
    const key = `${i.title}__${i.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(i);
  }

  return clampMax(uniq, 3);
}

