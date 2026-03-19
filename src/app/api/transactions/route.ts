import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { pool, testDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";
const DEMO_EMAIL = "demo@okane.local";

type DbTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  created_at: string;
};

async function resolveUserIdByEmail(input: { email: string; name: string }) {
  const found = await pool.query<{ id: string }>("select id from users where email = $1", [input.email]);
  const id = found.rows[0]?.id;
  if (!id) {
    const createdId = crypto.randomUUID();
    await pool.query("insert into users (id, email, name) values ($1, $2, $3)", [
      createdId,
      input.email,
      input.name || input.email
    ]);
    return createdId;
  }

  if (id === DEMO_USER_ID && input.email !== DEMO_EMAIL) {
    const newId = crypto.randomUUID();
    const tempEmail = `__migrating__${newId}@okane.local`;
    await pool.query("insert into users (id, email, name, onboarding_completed) values ($1, $2, $3, true)", [
      newId,
      tempEmail,
      input.name || input.email
    ]);
    await pool.query("update transactions set user_id = $1 where user_id = $2", [newId, DEMO_USER_ID]);
    await pool.query("update reflections set user_id = $1 where user_id = $2", [newId, DEMO_USER_ID]);
    await pool.query("delete from users where id = $1", [DEMO_USER_ID]);
    await pool.query("update users set email = $1, name = $2 where id = $3", [
      input.email,
      input.name || input.email,
      newId
    ]);
    return newId;
  }

  return id;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim() ?? "";
    const name = session?.user?.name?.trim() ?? "";
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

    await testDb();
    const userId = await resolveUserIdByEmail({ email, name });

    const result = await pool.query<DbTransaction>(
      "select id, user_id, amount, type, category, created_at from transactions where user_id = $1 order by created_at desc limit 200",
      [userId]
    );
    return NextResponse.json(result.rows, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("TRANSACTIONS ERROR:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim() ?? "";
    const name = session?.user?.name?.trim() ?? "";
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

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
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const userId = await resolveUserIdByEmail({ email, name });

    const id = crypto.randomUUID();
    const inserted = await pool.query<DbTransaction>(
      "insert into transactions (id, user_id, amount, type, category, created_at) values ($1, $2, $3, $4, $5, $6) returning id, user_id, amount, type, category, created_at",
      [id, userId, Math.abs(amount), type, category, createdAt]
    );

    return NextResponse.json(inserted.rows[0], { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("TRANSACTIONS ERROR:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
