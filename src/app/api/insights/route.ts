import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { generateInsights } from "@/lib/okane";
import type { Transaction } from "@/lib/types";
import { pool, testDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim() ?? "";
    const name = session?.user?.name?.trim() ?? "";
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

    await testDb();
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);

    const userResult = await pool.query<{ id: string }>("select id from users where email = $1", [email]);
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      const createdId = crypto.randomUUID();
      await pool.query("insert into users (id, email, name) values ($1, $2, $3)", [createdId, email, name || email]);
      return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });
    }

    const [txResult, reflectionResult] = await Promise.all([
      pool.query<DbTransaction>(
        "select id, amount, type, category, created_at from transactions where user_id = $1 and created_at >= $2 order by created_at desc",
        [userId, from.toISOString()]
      ),
      pool.query<DbReflection>(
        "select combined_text from reflections where user_id = $1 order by created_at desc limit 1",
        [userId]
      )
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

    return NextResponse.json(insights, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("INSIGHTS ERROR:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
