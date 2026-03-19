import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { pool, testDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";
const DEMO_EMAIL = "demo@okane.local";

type DbReflection = {
  id: string;
  user_id: string;
  sisa: string;
  perbaikan: string;
  kurangi: string;
  combined_text: string;
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

    const result = await pool.query<DbReflection>(
      "select id, user_id, sisa, perbaikan, kurangi, combined_text, created_at from reflections where user_id = $1 order by created_at desc limit 50",
      [userId]
    );
    return NextResponse.json(result.rows, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("REFLECTIONS ERROR:", err);
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
      sisa: string;
      perbaikan: string;
      kurangi: string;
      remaining: string;
      improve: string;
      reduce: string;
      created_at: string;
    }>;

    const sisa =
      typeof body.sisa === "string"
        ? body.sisa.trim()
        : typeof body.remaining === "string"
          ? body.remaining.trim()
          : "";
    const perbaikan =
      typeof body.perbaikan === "string"
        ? body.perbaikan.trim()
        : typeof body.improve === "string"
          ? body.improve.trim()
          : "";
    const kurangi =
      typeof body.kurangi === "string"
        ? body.kurangi.trim()
        : typeof body.reduce === "string"
          ? body.reduce.trim()
          : "";
    const createdAt = typeof body.created_at === "string" ? body.created_at : new Date().toISOString();
    const userId = await resolveUserIdByEmail({ email, name });

    const combinedText = `${sisa}\n${perbaikan}\n${kurangi}`.trim();
    const id = crypto.randomUUID();
    const inserted = await pool.query<DbReflection>(
      "insert into reflections (id, user_id, sisa, perbaikan, kurangi, combined_text, created_at) values ($1, $2, $3, $4, $5, $6, $7) returning id, user_id, sisa, perbaikan, kurangi, combined_text, created_at",
      [id, userId, sisa, perbaikan, kurangi, combinedText, createdAt]
    );

    return NextResponse.json(inserted.rows[0], { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("REFLECTIONS ERROR:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
