import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { query } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim() ?? "";
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const body = (await request.json()) as Partial<{ goal: string; monthlyIncome: number }>;
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const monthlyIncome =
    typeof body.monthlyIncome === "number" && Number.isFinite(body.monthlyIncome) ? Math.max(0, Math.trunc(body.monthlyIncome)) : 0;

  await query(
    "update users set onboarding_completed = true, goal = $1, monthly_income = $2 where email = $3",
    [goal, monthlyIncome, email]
  );

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
