import { NextResponse } from "next/server";

import { pool, testDb } from "@/lib/db";

export const runtime = "nodejs";

type DbReflection = {
  id: string;
  user_id: string;
  sisa: string;
  perbaikan: string;
  kurangi: string;
  combined_text: string;
  created_at: string;
};

export async function GET() {
  try {
    await testDb();
    const result = await pool.query<DbReflection>(
      "select id, user_id, sisa, perbaikan, kurangi, combined_text, created_at from reflections order by created_at desc limit 50"
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("REFLECTIONS ERROR:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await testDb();
    const body = (await request.json()) as Partial<{
      user_id: string;
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
    const demoUserId = "00000000-0000-0000-0000-000000000000";
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : demoUserId;

    if (!userId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (userId === demoUserId) {
      await pool.query(
        "insert into users (id, email, name) values ($1, $2, $3) on conflict (id) do nothing",
        [demoUserId, "demo@okane.local", "Demo"]
      );
    }

    const combinedText = `${sisa}\n${perbaikan}\n${kurangi}`.trim();
    const id = crypto.randomUUID();
    const inserted = await pool.query<DbReflection>(
      "insert into reflections (id, user_id, sisa, perbaikan, kurangi, combined_text, created_at) values ($1, $2, $3, $4, $5, $6, $7) returning id, user_id, sisa, perbaikan, kurangi, combined_text, created_at",
      [id, userId, sisa, perbaikan, kurangi, combinedText, createdAt]
    );

    return NextResponse.json(inserted.rows[0], { status: 201 });
  } catch (err) {
    console.error("REFLECTIONS ERROR:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
