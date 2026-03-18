export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  note?: string;
  date: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
};

export type Category = {
  id: string;
  name: string;
  budget: number;
  type: "default" | "custom";
};

export type KakeiboCategory = "Needs" | "Wants" | "Culture" | "Unexpected";

export type InsightKind =
  | "budget_warning"
  | "over_budget"
  | "spending_highlight"
  | "weekly_summary"
  | "reflection_reminder";

export type Insight = {
  id: string;
  kind: InsightKind;
  tone: "neutral" | "positive" | "warning";
  title: string;
  message: string;
  source?: "reflection" | "data";
};

export type Toast = {
  id: string;
  title: string;
  message?: string;
  createdAt: string;
};

export type UserProgress = {
  daysActive: number;
  transactionsThisWeek: number;
  isConsistent: boolean;
  unlockedFeatures: string[];
};

export type Reflection = {
  id: string;
  weekOf: string;
  remaining: string;
  improve: string;
  reduce: string;
  createdAt: string;
};
