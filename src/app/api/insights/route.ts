import { NextResponse } from "next/server";

import { generateInsights } from "@/lib/okane";
import type { Transaction } from "@/lib/types";
import { pool, testDb } from "@/lib/db";

export const runtime = "nodejs";

type DbTransaction = {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  created_at: string;
};

type DbReflection = {
  combined_text: string;
};

export async function GET(request: Request) {
  try {
    await testDb();
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);

    const txQuery =
      userId && userId.trim()
        ? {
            text: "select id, amount, type, category, created_at from transactions where user_id = $1 and created_at >= $2 order by created_at desc",
            params: [userId.trim(), from.toISOString()]
          }
        : {
            text: "select id, amount, type, category, created_at from transactions where created_at >= $1 order by created_at desc",
            params: [from.toISOString()]
          };
    const reflQuery =
      userId && userId.trim()
        ? {
            text: "select combined_text from reflections where user_id = $1 order by created_at desc limit 1",
            params: [userId.trim()]
          }
        : {
            text: "select combined_text from reflections order by created_at desc limit 1",
            params: []
          };

    const [txResult, reflectionResult] = await Promise.all([
      pool.query<DbTransaction>(txQuery.text, txQuery.params),
      pool.query<DbReflection>(reflQuery.text, reflQuery.params)
    ]);

    const transactions: Transaction[] = txResult.rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      type: r.type,
      category: r.category,
      date: r.created_at
    }));

    const insights = generateInsights({
      nowIso: now.toISOString(),
      transactions,
      categories: [],
      reflections: [],
      latestReflectionText: reflectionResult.rows[0]?.combined_text || ""
    });

    return NextResponse.json(insights);
  } catch (err) {
    console.error("INSIGHTS ERROR:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
