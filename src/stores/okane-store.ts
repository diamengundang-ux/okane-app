"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createId, DEFAULT_CATEGORIES } from "@/lib/okane";
import type {
  Category,
  Reflection,
  Toast,
  Transaction as OkaneTransaction,
  User,
  UserProgress as OkaneUserProgress,
  Insight
} from "@/lib/types";

type AddTransactionInput = Omit<OkaneTransaction, "id" | "date"> & { date?: string };

type SaveReflectionInput = Omit<Reflection, "id" | "createdAt" | "weekOf"> & {
  weekOf?: string;
};

type AddTransactionResult = { unlockedNow: string[] } | null;

type OnboardingState = {
  completed: boolean;
  goal: string;
  monthlyIncome: number;
};

export type OkaneState = {
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  toast: Toast | null;
  setToast: (toast: Omit<Toast, "id" | "createdAt">) => void;
  clearToast: () => void;

  userProgress: OkaneUserProgress;
  recomputeUserProgress: () => void;

  user: User | null;
  signInWithGoogle: (token: string) => Promise<boolean>;
  signOut: () => void;

  onboarding: OnboardingState;
  setOnboardingGoal: (goal: string) => void;
  setOnboardingMonthlyIncome: (monthlyIncome: number) => void;
  completeOnboarding: () => void;

  transactions: OkaneTransaction[];
  addTransaction: (input: AddTransactionInput) => AddTransactionResult;
  clearTransactions: () => void;

  categories: Category[];
  addCategory: (input: { name: string; budget: number }) => void;
  updateCategory: (id: string, patch: Partial<Omit<Category, "id" | "type">>) => void;
  deleteCategory: (id: string) => void;

  reflections: Reflection[];
  saveReflection: (input: SaveReflectionInput) => void;
  clearReflections: () => void;
};

type OkanePersistedState = Pick<
  OkaneState,
  "user" | "onboarding" | "transactions" | "categories" | "reflections"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function dayKeyUTC(iso: string) {
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

function computeUserProgress(input: {
  nowIso: string;
  transactions: OkaneTransaction[];
  categories: Category[];
  reflections: Reflection[];
  previousUnlocked: string[];
}): { progress: OkaneUserProgress; unlockedNow: string[] } {
  const last7 = lastNDaysKeysUTC(input.nowIso, 7);
  const last7Set = new Set(last7);

  const activeDaysSet = new Set<string>();
  let transactionsThisWeek = 0;

  for (const tx of input.transactions) {
    const key = dayKeyUTC(tx.date);
    if (last7Set.has(key)) {
      transactionsThisWeek += 1;
      activeDaysSet.add(key);
    }
  }

  const daysActive = activeDaysSet.size;
  const isConsistent = daysActive >= 5;

  const unlocked = new Set<string>(input.previousUnlocked.length ? input.previousUnlocked : ["core"]);
  const unlockedNow: string[] = [];

  if (input.categories.some((c) => c.type === "custom") && !unlocked.has("advanced_categories")) {
    unlocked.add("advanced_categories");
    unlockedNow.push("advanced_categories");
  }

  if (isConsistent) {
    for (const f of ["savings_tracker", "advanced_categories", "modules"] as const) {
      if (!unlocked.has(f)) {
        unlocked.add(f);
        unlockedNow.push(f);
      }
    }
  }

  return {
    progress: {
      daysActive,
      transactionsThisWeek,
      isConsistent,
      unlockedFeatures: Array.from(unlocked)
    },
    unlockedNow
  };
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

      userProgress: {
        daysActive: 0,
        transactionsThisWeek: 0,
        isConsistent: false,
        unlockedFeatures: ["core"]
      },
      recomputeUserProgress: () => {
        const nowIso = new Date().toISOString();
        const { progress } = computeUserProgress({
          nowIso,
          transactions: get().transactions,
          categories: get().categories,
          reflections: get().reflections,
          previousUnlocked: get().userProgress.unlockedFeatures
        });
        set({ userProgress: progress });
      },

      user: null,
      signInWithGoogle: async (token) => {
        try {
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token })
          });
          if (!res.ok) return false;

          const json = (await res.json()) as {
            user?: { id?: string; name?: string; email?: string };
          };
          const u = json.user;
          if (!u || typeof u.id !== "string" || typeof u.name !== "string" || typeof u.email !== "string") {
            return false;
          }

          set({
            user: {
              id: u.id,
              name: u.name,
              email: u.email
            }
          });
          return true;
        } catch {
          return false;
        }
      },
      signOut: () => set({ user: null }),

      onboarding: {
        completed: false,
        goal: "",
        monthlyIncome: 0
      },
      setOnboardingGoal: (goal) =>
        set({
          onboarding: {
            ...get().onboarding,
            goal: goal.trim()
          }
        }),
      setOnboardingMonthlyIncome: (monthlyIncome) =>
        set({
          onboarding: {
            ...get().onboarding,
            monthlyIncome: Number.isFinite(monthlyIncome) ? Math.max(0, Math.round(monthlyIncome)) : 0
          }
        }),
      completeOnboarding: () =>
        set({
          onboarding: {
            ...get().onboarding,
            completed: true
          }
        }),

      transactions: [],
      addTransaction: (input) => {
        const now = new Date().toISOString();
        const tx: OkaneTransaction = {
          id: createId(),
          amount: input.amount,
          type: input.type,
          category: input.category,
          note: input.note,
          date: input.date ?? now
        };
        const nextTransactions = [tx, ...get().transactions];
        const computed = computeUserProgress({
          nowIso: now,
          transactions: nextTransactions,
          categories: get().categories,
          reflections: get().reflections,
          previousUnlocked: get().userProgress.unlockedFeatures
        });
        set({ transactions: nextTransactions, userProgress: computed.progress });
        return computed.unlockedNow.length ? { unlockedNow: computed.unlockedNow } : null;
      },
      clearTransactions: () => {
        set({
          transactions: [],
          userProgress: {
            daysActive: 0,
            transactionsThisWeek: 0,
            isConsistent: false,
            unlockedFeatures: ["core"]
          }
        });
      },

      categories: DEFAULT_CATEGORIES,
      addCategory: ({ name, budget }) => {
        const next: Category = {
          id: createId(),
          name,
          budget,
          type: "custom"
        };
        const categories = [...get().categories, next];
        const nowIso = new Date().toISOString();
        const computed = computeUserProgress({
          nowIso,
          transactions: get().transactions,
          categories,
          reflections: get().reflections,
          previousUnlocked: get().userProgress.unlockedFeatures
        });
        set({ categories, userProgress: computed.progress });
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

          const transactions =
            nextName && nextName !== prev.name
              ? state.transactions.map((tx) =>
                  tx.category === prev.name ? { ...tx, category: nextName } : tx
                )
              : state.transactions;

          return { categories, transactions };
        });
      },
      deleteCategory: (id) => {
        const categories = get().categories.filter((c) => c.id !== id);
        const nowIso = new Date().toISOString();
        const computed = computeUserProgress({
          nowIso,
          transactions: get().transactions,
          categories,
          reflections: get().reflections,
          previousUnlocked: get().userProgress.unlockedFeatures
        });
        set({ categories, userProgress: computed.progress });
      },

      reflections: [],
      saveReflection: (input) => {
        const now = new Date();
        const weekOf = input.weekOf ?? now.toISOString().slice(0, 10);
        const reflection: Reflection = {
          id: createId(),
          weekOf,
          remaining: input.remaining,
          improve: input.improve,
          reduce: input.reduce,
          createdAt: now.toISOString()
        };
        const reflections = [reflection, ...get().reflections];
        const computed = computeUserProgress({
          nowIso: now.toISOString(),
          transactions: get().transactions,
          categories: get().categories,
          reflections,
          previousUnlocked: get().userProgress.unlockedFeatures
        });
        set({ reflections, userProgress: computed.progress });
      },
      clearReflections: () => set({ reflections: [] })
    }),
    {
      name: "okane-store",
      storage: safeStorage(),
      version: 3,
      migrate: (persistedState: unknown) => {
        const s = isRecord(persistedState) ? persistedState : {};

        const user = (s.user as User | null | undefined) ?? null;
        const onboardingRaw = isRecord(s.onboarding) ? s.onboarding : {};
        const onboarding: OnboardingState = {
          completed: Boolean(onboardingRaw.completed),
          goal: typeof onboardingRaw.goal === "string" ? onboardingRaw.goal : "",
          monthlyIncome: toNumber(onboardingRaw.monthlyIncome)
        };
        const transactions = Array.isArray(s.transactions)
          ? (s.transactions as OkaneTransaction[])
          : [];
        const reflections = Array.isArray(s.reflections)
          ? (s.reflections as Reflection[])
          : [];

        if (Array.isArray(s.categories)) {
          return {
            user,
            onboarding,
            transactions,
            categories: s.categories as Category[],
            reflections
          };
        }

        if (isRecord(s.budgets)) {
          const budgets = s.budgets;
          return {
            user,
            onboarding,
            transactions,
            categories: DEFAULT_CATEGORIES.map((c) => ({
              ...c,
              budget: toNumber(budgets[c.name])
            })),
            reflections
          };
        }

        return { user, onboarding, transactions, categories: DEFAULT_CATEGORIES, reflections };
      },
      partialize: (state) => ({
        user: state.user,
        onboarding: state.onboarding,
        transactions: state.transactions,
        categories: state.categories,
        reflections: state.reflections
      }),
      onRehydrateStorage: () => (state) => {
        state?.recomputeUserProgress();
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
  transactions: Transaction[];
  userProgress: UserProgress;
  latestReflection: LatestReflection | null;
  insights: Insight[];
  habit: HabitState;

  addTransaction: (tx: Transaction) => void;
  calculateConsistency: () => void;
  unlockFeatures: () => void;
  updateStreak: (date: string) => void;
  getConsistency: () => string;
  setLatestReflection: (reflection: { remaining: string; improve: string; reduce: string }) => Promise<boolean>;
  loadFromApi: () => Promise<void>;
  loadInsightsFromApi: () => Promise<void>;
};

type AppPersistedState = Pick<
  AppState,
  "transactions" | "userProgress" | "latestReflection" | "insights" | "habit"
>;

function safeAppStorage() {
  return createJSONStorage<AppPersistedState>(() => {
    if (typeof window !== "undefined") return window.localStorage;
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
  });
}

function toDayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
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

function seedTransactions(nowIso: string): Transaction[] {
  const now = new Date(nowIso);
  const mk = (daysAgo: number, amount: number, category: string): Transaction => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(9, 0, 0, 0);
    return { id: createId(), amount, category, date: d.toISOString() };
  };
  return [
    mk(0, 25000, "Wants"),
    mk(1, 18000, "Needs"),
    mk(2, 12000, "Culture"),
    mk(4, 35000, "Needs")
  ];
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
  persist<AppState, [], [], AppPersistedState>(
    (set, get) => {
      const nowIso = new Date().toISOString();
      const initialTransactions = seedTransactions(nowIso);
      const base = computeConsistency(initialTransactions, nowIso);
      const initialHabit = computeHabitFromTransactions(initialTransactions, nowIso);
      const initial: UserProgress = {
        transactionDates: base.transactionDates,
        isConsistent: base.isConsistent,
        unlockedFeatures: ["core"]
      };

      return {
        transactions: initialTransactions,
        userProgress: initial,
        latestReflection: null,
        insights: [],
        habit: initialHabit,

        addTransaction: (tx) => {
          const day = toDayKey(tx.date);
          get().updateStreak(day);

          const runLocal = (effectiveTx: Transaction) => {
            set((state) => {
              const now = new Date().toISOString();
              const nextTransactions = [effectiveTx, ...state.transactions];
              const nextConsistency = computeConsistency(nextTransactions, now);
              const unlocked = new Set<string>(["core"]);
              if (nextConsistency.isConsistent) {
                for (const f of ["savings", "savings_tracker", "advanced_categories", "modules"]) unlocked.add(f);
              }
              return {
                transactions: nextTransactions,
                userProgress: {
                  transactionDates: nextConsistency.transactionDates,
                  isConsistent: nextConsistency.isConsistent,
                  unlockedFeatures: Array.from(unlocked)
                }
              };
            });
          };

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

              if (!res.ok) {
                runLocal(tx);
                return;
              }

              const t = (await res.json()) as {
                id?: string;
                amount?: number;
                type?: "income" | "expense";
                category?: string;
                created_at?: string;
              };
              if (!t) {
                runLocal(tx);
                return;
              }
              if (
                typeof t.id !== "string" ||
                typeof t.amount !== "number" ||
                (t.type !== "income" && t.type !== "expense") ||
                typeof t.category !== "string" ||
                typeof t.created_at !== "string"
              ) {
                runLocal(tx);
                return;
              }
              const signed = t.type === "expense" ? -t.amount : t.amount;
              runLocal({ id: t.id, amount: signed, category: t.category, date: t.created_at });
            } catch {
              runLocal(tx);
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
          const nextLocal: LatestReflection = {
            raw: {
              remaining: input.remaining,
              improve: input.improve,
              reduce: input.reduce
            },
            text: `${input.remaining}\n${input.improve}\n${input.reduce}`.trim(),
            createdAt: new Date().toISOString()
          };

          set({ latestReflection: nextLocal });

          try {
            const res = await fetch("/api/reflections", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                remaining: input.remaining,
                improve: input.improve,
                reduce: input.reduce,
                created_at: nextLocal.createdAt
              })
            });

            if (!res.ok) return false;

            const r = (await res.json()) as {
              sisa?: string;
              perbaikan?: string;
              kurangi?: string;
              combined_text?: string;
              created_at?: string;
            };

            if (
              typeof r.sisa !== "string" ||
              typeof r.perbaikan !== "string" ||
              typeof r.kurangi !== "string" ||
              typeof r.combined_text !== "string" ||
              typeof r.created_at !== "string"
            ) {
              return false;
            }

            set({
              latestReflection: {
                raw: { remaining: r.sisa, improve: r.perbaikan, reduce: r.kurangi },
                text: r.combined_text,
                createdAt: r.created_at
              }
            });

            return true;
          } catch {
            return false;
          }
        },

        loadFromApi: async () => {
          try {
            const [txRes, reflRes] = await Promise.all([
              fetch("/api/transactions", { cache: "no-store" }),
              fetch("/api/reflections", { cache: "no-store" })
            ]);
            if (!txRes.ok || !reflRes.ok) return;

            const txJson = (await txRes.json()) as
              | Array<{
                  id: string;
                  amount: number;
                  type: "income" | "expense";
                  category: string;
                  created_at: string;
                }>
              | {
                  transactions?: Array<{
                    id: string;
                    amount: number;
                    type: "income" | "expense";
                    category: string;
                    created_at: string;
                  }>;
                };
            const reflJson = (await reflRes.json()) as
              | Array<{
                  sisa: string;
                  perbaikan: string;
                  kurangi: string;
                  combined_text: string;
                  created_at: string;
                }>
              | {
                  reflections?: Array<{
                    sisa: string;
                    perbaikan: string;
                    kurangi: string;
                    combined_text: string;
                    created_at: string;
                  }>;
                };

            const txRows = Array.isArray(txJson) ? txJson : (txJson.transactions ?? []);
            const reflRows = Array.isArray(reflJson) ? reflJson : (reflJson.reflections ?? []);

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
            const res = await fetch("/api/insights", { cache: "no-store" });
            if (!res.ok) return;
            const json = (await res.json()) as Insight[] | { insights?: Insight[] };
            const rows = Array.isArray(json) ? json : json.insights;
            if (!Array.isArray(rows)) return;
            set({ insights: rows });
          } catch {
            return;
          }
        }
      };
    },
    {
      name: "okane-app-sim",
      storage: safeAppStorage(),
      version: 3,
      migrate: (persistedState: unknown) => {
        const s = isRecord(persistedState) ? persistedState : {};

        const transactions = Array.isArray(s.transactions) ? (s.transactions as Transaction[]) : [];
        const latestReflection = isRecord(s.latestReflection)
          ? (s.latestReflection as LatestReflection)
          : null;
        const insights = Array.isArray(s.insights) ? (s.insights as Insight[]) : [];

        const habitRaw = isRecord(s.habit) ? s.habit : {};
        const habit: HabitState = {
          streak: toNumber(habitRaw.streak),
          lastEntryDate: typeof habitRaw.lastEntryDate === "string" ? habitRaw.lastEntryDate : null,
          activeDays: Array.isArray(habitRaw.activeDays) ? (habitRaw.activeDays as string[]) : []
        };

        const nowIso = new Date().toISOString();
        const c = computeConsistency(transactions, nowIso);
        const unlocked = new Set<string>(["core"]);
        if (c.isConsistent) {
          for (const f of ["savings", "savings_tracker", "advanced_categories", "modules"]) unlocked.add(f);
        }
        const userProgress: UserProgress = {
          transactionDates: c.transactionDates,
          isConsistent: c.isConsistent,
          unlockedFeatures: Array.from(unlocked)
        };
        const fallbackHabit = habit.activeDays.length || habit.lastEntryDate || habit.streak
          ? habit
          : computeHabitFromTransactions(transactions, nowIso);

        return {
          transactions,
          userProgress,
          latestReflection,
          insights,
          habit: fallbackHabit
        };
      },
      partialize: (state) => ({
        transactions: state.transactions,
        userProgress: state.userProgress,
        latestReflection: state.latestReflection,
        insights: state.insights,
        habit: state.habit
      })
    }
  )
);
