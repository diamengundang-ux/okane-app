import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
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
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim() ?? "";
    const name = session?.user?.name?.trim() ?? "";
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await testDb();
    const userResult = await pool.query<{ id: string }>("select id from users where email = $1", [email]);
    const userId = userResult.rows[0]?.id;
    if (!userId) {
      const createdId = crypto.randomUUID();
      await pool.query("insert into users (id, email, name) values ($1, $2, $3)", [createdId, email, name || email]);
      const result = await pool.query<DbTransaction>(
        "select id, user_id, amount, type, category, created_at from transactions where user_id = $1 order by created_at desc limit 200",
        [createdId]
      );
      return NextResponse.json(result.rows);
    }

    const result = await pool.query<DbTransaction>(
      "select id, user_id, amount, type, category, created_at from transactions where user_id = $1 order by created_at desc limit 200",
      [userId]
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
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim() ?? "";
    const name = session?.user?.name?.trim() ?? "";
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await testDb();
    const body = (await request.json()) as Partial<{
      amount: number;
      type: "income" | "expense";
      category: string;
      created_at: string;
    }>;

    const amount = typeof body.amount === "number" && Number.isFinite(body.amount) ? Math.trunc(body.amount) : NaN;
    const type = body.type === "income" || body.type === "expense" ? body.type : null;
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const createdAt = typeof body.created_at === "string" ? body.created_at : new Date().toISOString();

    if (!Number.isFinite(amount) || !type || !category) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const userResult = await pool.query<{ id: string }>("select id from users where email = $1", [email]);
    const userId = userResult.rows[0]?.id ?? crypto.randomUUID();
    if (!userResult.rows[0]) {
      await pool.query("insert into users (id, email, name) values ($1, $2, $3)", [userId, email, name || email]);
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
