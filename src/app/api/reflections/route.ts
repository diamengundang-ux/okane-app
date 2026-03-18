import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
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
      return NextResponse.json([]);
    }

    const result = await pool.query<DbReflection>(
      "select id, user_id, sisa, perbaikan, kurangi, combined_text, created_at from reflections where user_id = $1 order by created_at desc limit 50",
      [userId]
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
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim() ?? "";
    const name = session?.user?.name?.trim() ?? "";
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const userResult = await pool.query<{ id: string }>("select id from users where email = $1", [email]);
    const userId = userResult.rows[0]?.id ?? crypto.randomUUID();
    if (!userResult.rows[0]) {
      await pool.query("insert into users (id, email, name) values ($1, $2, $3)", [userId, email, name || email]);
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
