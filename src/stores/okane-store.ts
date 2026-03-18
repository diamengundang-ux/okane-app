"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createId, DEFAULT_CATEGORIES } from "@/lib/okane";
import type { Category, Toast, Insight } from "@/lib/types";

export type OkaneState = {
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  toast: Toast | null;
  setToast: (toast: Omit<Toast, "id" | "createdAt">) => void;
  clearToast: () => void;

  categories: Category[];
  addCategory: (input: { name: string; budget: number }) => void;
  updateCategory: (id: string, patch: Partial<Omit<Category, "id" | "type">>) => void;
  deleteCategory: (id: string) => void;
};

type OkanePersistedState = Pick<OkaneState, "categories">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeStorage() {
  return createJSONStorage<OkanePersistedState>(() => {
    if (typeof window !== "undefined") return window.localStorage;
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
  });
}

export const useOkaneStore = create<OkaneState>()(
  persist<OkaneState, [], [], OkanePersistedState>(
    (set, get) => ({
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      toast: null,
      setToast: (toast) =>
        set({
          toast: { id: createId(), createdAt: new Date().toISOString(), ...toast }
        }),
      clearToast: () => set({ toast: null }),

      categories: DEFAULT_CATEGORIES,
      addCategory: ({ name, budget }) => {
        const next: Category = {
          id: createId(),
          name,
          budget,
          type: "custom"
        };
        const categories = [...get().categories, next];
        set({ categories });
      },
      updateCategory: (id, patch) => {
        const prev = get().categories.find((c) => c.id === id);
        if (!prev) return;

        const nextName =
          typeof patch.name === "string" ? patch.name.trim() : undefined;

        set((state) => {
          const categories = state.categories.map((c) =>
            c.id === id ? { ...c, ...patch, name: nextName ?? c.name } : c
          );
          return { categories };
        });
      },
      deleteCategory: (id) => {
        const categories = get().categories.filter((c) => c.id !== id);
        set({ categories });
      },
    }),
    {
      name: "okane-store",
      storage: safeStorage(),
      version: 4,
      migrate: (persistedState: unknown) => {
        const s = isRecord(persistedState) ? persistedState : {};

        if (Array.isArray(s.categories)) {
          return {
            categories: s.categories as Category[]
          };
        }

        if (isRecord(s.budgets)) {
          const budgets = s.budgets;
          return {
            categories: DEFAULT_CATEGORIES.map((c) => ({
              ...c,
              budget: toNumber(budgets[c.name])
            }))
          };
        }

        return { categories: DEFAULT_CATEGORIES };
      },
      partialize: (state) => ({
        categories: state.categories
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);

export type Transaction = {
  id: string;
  amount: number;
  category: string;
  date: string;
};

export type UserProgress = {
  transactionDates: string[];
  isConsistent: boolean;
  unlockedFeatures: string[];
};

export type LatestReflection = {
  raw: {
    remaining: string;
    improve: string;
    reduce: string;
  };
  text: string;
  createdAt: string;
};

export type HabitState = {
  streak: number;
  lastEntryDate: string | null;
  activeDays: string[];
};

export type AppState = {
  activeUserEmail: string | null;
  setActiveUserEmail: (email: string | null) => void;

  transactions: Transaction[];
  userProgress: UserProgress;
  latestReflection: LatestReflection | null;
  insights: Insight[];
  habit: HabitState;

  reset: () => void;
  addTransaction: (tx: Transaction) => void;
  calculateConsistency: () => void;
  unlockFeatures: () => void;
  updateStreak: (date: string) => void;
  getConsistency: () => string;
  setLatestReflection: (reflection: { remaining: string; improve: string; reduce: string }) => Promise<boolean>;
  loadData: () => Promise<void>;
  loadFromApi: () => Promise<void>;
  loadInsightsFromApi: () => Promise<void>;
};

function toDayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
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

function computeConsistency(transactions: Transaction[], nowIso: string) {
  const last7 = lastNDaysKeysUTC(nowIso, 7);
  const last7Set = new Set(last7);
  const dates = new Set<string>();
  for (const tx of transactions) {
    const key = toDayKey(tx.date);
    if (!last7Set.has(key)) continue;
    dates.add(key);
  }
  const transactionDates = Array.from(dates).sort();
  return { transactionDates, isConsistent: transactionDates.length >= 5 };
}

function parseYmdUtc(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addDaysYmdUtc(ymd: string, days: number) {
  const d = parseYmdUtc(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeHabitFromTransactions(transactions: Transaction[], nowIso: string): HabitState {
  const days = new Set<string>();
  for (const tx of transactions) days.add(toDayKey(tx.date));
  const activeDays = Array.from(days).sort();

  const lastEntryDate = activeDays.length ? activeDays[activeDays.length - 1] : null;
  if (!lastEntryDate) return { streak: 0, lastEntryDate: null, activeDays };

  let streak = 1;
  let cursor = lastEntryDate;
  const daySet = new Set(activeDays);
  for (;;) {
    const prev = addDaysYmdUtc(cursor, -1);
    if (!daySet.has(prev)) break;
    streak += 1;
    cursor = prev;
  }

  const today = new Date(nowIso);
  const todayKey = today.toISOString().slice(0, 10);
  if (lastEntryDate !== todayKey && addDaysYmdUtc(todayKey, -1) !== lastEntryDate) {
    streak = 0;
  }

  return { streak, lastEntryDate, activeDays };
}

function nextStreak(prev: HabitState, today: string): HabitState {
  const activeDays = prev.activeDays.includes(today) ? prev.activeDays : [...prev.activeDays, today].sort();
  if (!prev.lastEntryDate) return { streak: 1, lastEntryDate: today, activeDays };
  if (prev.lastEntryDate === today) return { ...prev, activeDays };

  const yesterday = addDaysYmdUtc(today, -1);
  if (prev.lastEntryDate === yesterday) {
    return { streak: prev.streak + 1, lastEntryDate: today, activeDays };
  }

  return { streak: 1, lastEntryDate: today, activeDays };
}

export const useAppStore = create<AppState>()(
  (set, get) => ({
    activeUserEmail: null,
    setActiveUserEmail: (email) => set({ activeUserEmail: email }),

    transactions: [],
    userProgress: { transactionDates: [], isConsistent: false, unlockedFeatures: ["core"] },
    latestReflection: null,
    insights: [],
    habit: { streak: 0, lastEntryDate: null, activeDays: [] },

    reset: () =>
      set({
        transactions: [],
        userProgress: { transactionDates: [], isConsistent: false, unlockedFeatures: ["core"] },
        latestReflection: null,
        insights: [],
        habit: { streak: 0, lastEntryDate: null, activeDays: [] }
      }),

    addTransaction: (tx) => {
      const day = toDayKey(tx.date);
      set((state) => ({ habit: nextStreak(state.habit, day) }));

      void (async () => {
        try {
          const type = tx.amount >= 0 ? "income" : "expense";
          const res = await fetch("/api/transactions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              amount: Math.abs(tx.amount),
              type,
              category: tx.category,
              created_at: tx.date
            })
          });
          if (!res.ok) return;
          await get().loadData();
        } catch {
          return;
        }
      })();
    },

    updateStreak: (date) => {
      set((state) => ({ habit: nextStreak(state.habit, date) }));
    },

    getConsistency: () => {
      const nowIso = new Date().toISOString();
      const last7 = lastNDaysKeysUTC(nowIso, 7);
      const setDays = new Set(get().habit.activeDays);
      let active = 0;
      for (const d of last7) if (setDays.has(d)) active += 1;
      return `${active}/7 hari`;
    },

    calculateConsistency: () => {
      const now = new Date().toISOString();
      const nextConsistency = computeConsistency(get().transactions, now);
      set({
        userProgress: {
          ...get().userProgress,
          transactionDates: nextConsistency.transactionDates,
          isConsistent: nextConsistency.isConsistent
        }
      });
    },

    unlockFeatures: () => {
      const unlocked = new Set<string>(["core"]);
      if (get().userProgress.isConsistent) {
        for (const f of ["savings", "savings_tracker", "advanced_categories", "modules"]) unlocked.add(f);
      }
      set({ userProgress: { ...get().userProgress, unlockedFeatures: Array.from(unlocked) } });
    },

    setLatestReflection: async (input) => {
      const createdAt = new Date().toISOString();
      set({
        latestReflection: {
          raw: { remaining: input.remaining, improve: input.improve, reduce: input.reduce },
          text: `${input.remaining}\n${input.improve}\n${input.reduce}`.trim(),
          createdAt
        }
      });

      try {
        const res = await fetch("/api/reflections", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            remaining: input.remaining,
            improve: input.improve,
            reduce: input.reduce,
            created_at: createdAt
          })
        });

        if (!res.ok) return false;
        await get().loadData();
        return true;
      } catch {
        return false;
      }
    },

    loadData: async () => {
      await get().loadFromApi();
      await get().loadInsightsFromApi();
    },

    loadFromApi: async () => {
      try {
        const expectedUser = get().activeUserEmail;
        const [txRes, reflRes] = await Promise.all([
          fetch("/api/transactions", { cache: "no-store" }),
          fetch("/api/reflections", { cache: "no-store" })
        ]);
        if (!txRes.ok || !reflRes.ok) return;

        const txRows = (await txRes.json()) as Array<{
          id: string;
          amount: number;
          type: "income" | "expense";
          category: string;
          created_at: string;
        }>;
        const reflRows = (await reflRes.json()) as Array<{
          sisa: string;
          perbaikan: string;
          kurangi: string;
          combined_text: string;
          created_at: string;
        }>;

        const txs = txRows.map((t) => ({
          id: t.id,
          amount: t.type === "expense" ? -t.amount : t.amount,
          category: t.category,
          date: t.created_at
        }));
        const latest = reflRows[0];
        const latestReflection = latest
          ? {
              raw: { remaining: latest.sisa, improve: latest.perbaikan, reduce: latest.kurangi },
              text: latest.combined_text,
              createdAt: latest.created_at
            }
          : null;

        const nowIso = new Date().toISOString();
        const c = computeConsistency(txs, nowIso);
        const habit = computeHabitFromTransactions(txs, nowIso);
        const unlocked = new Set<string>(["core"]);
        if (c.isConsistent) {
          for (const f of ["savings", "savings_tracker", "advanced_categories", "modules"]) unlocked.add(f);
        }

        if (expectedUser !== get().activeUserEmail) return;
        set({
          transactions: txs,
          latestReflection,
          habit,
          userProgress: {
            transactionDates: c.transactionDates,
            isConsistent: c.isConsistent,
            unlockedFeatures: Array.from(unlocked)
          }
        });
      } catch {
        return;
      }
    },

    loadInsightsFromApi: async () => {
      try {
        const expectedUser = get().activeUserEmail;
        const res = await fetch("/api/insights", { cache: "no-store" });
        if (!res.ok) return;
        const rows = (await res.json()) as Insight[];
        if (!Array.isArray(rows)) return;
        if (expectedUser !== get().activeUserEmail) return;
        set({ insights: rows });
      } catch {
        return;
      }
    }
  })
);
