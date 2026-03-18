import { NextResponse } from "next/server";

import { pool, testDb } from "@/lib/db";

export const runtime = "nodejs";

type DbTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  created_at: string;
};

export async function GET() {
  try {
    await testDb();
    const result = await pool.query<DbTransaction>(
      "select id, user_id, amount, type, category, created_at from transactions order by created_at desc limit 200"
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("TRANSACTIONS ERROR:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await testDb();
    const body = (await request.json()) as Partial<{
      user_id: string;
      amount: number;
      type: "income" | "expense";
      category: string;
      created_at: string;
    }>;

    const amount = typeof body.amount === "number" && Number.isFinite(body.amount) ? Math.trunc(body.amount) : NaN;
    const type = body.type === "income" || body.type === "expense" ? body.type : null;
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const createdAt = typeof body.created_at === "string" ? body.created_at : new Date().toISOString();
    const demoUserId = "00000000-0000-0000-0000-000000000000";
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : demoUserId;

    if (!userId || !Number.isFinite(amount) || !type || !category) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (userId === demoUserId) {
      await pool.query(
        "insert into users (id, email, name) values ($1, $2, $3) on conflict (id) do nothing",
        [demoUserId, "demo@okane.local", "Demo"]
      );
    }

    const id = crypto.randomUUID();
    const inserted = await pool.query<DbTransaction>(
      "insert into transactions (id, user_id, amount, type, category, created_at) values ($1, $2, $3, $4, $5, $6) returning id, user_id, amount, type, category, created_at",
      [id, userId, Math.abs(amount), type, category, createdAt]
    );

    return NextResponse.json(inserted.rows[0], { status: 201 });
  } catch (err) {
    console.error("TRANSACTIONS ERROR:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
