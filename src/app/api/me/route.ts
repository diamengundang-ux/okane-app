import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { query } from "@/server/db";

export const runtime = "nodejs";

type DbUser = {
  id: string;
  email: string;
  name: string;
  onboarding_completed: boolean;
  goal: string;
  monthly_income: number;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim() ?? "";
  const name = session?.user?.name?.trim() ?? "";
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const found = await query<DbUser>(
    "select id, email, name, onboarding_completed, goal, monthly_income from users where email = $1",
    [email]
  );

  if (!found.rows[0]) {
    const id = crypto.randomUUID();
    const inserted = await query<DbUser>(
      "insert into users (id, email, name) values ($1, $2, $3) returning id, email, name, onboarding_completed, goal, monthly_income",
      [id, email, name || email]
    );
    return NextResponse.json({ isNewUser: true, onboardingCompleted: false, user: inserted.rows[0] });
  }

  const user = found.rows[0];
  const hasActivity = await query<{ exists: boolean }>(
    "select exists(select 1 from transactions where user_id = $1) or exists(select 1 from reflections where user_id = $1) as exists",
    [user.id]
  );
  const onboardingCompleted = Boolean(user.onboarding_completed) || Boolean(hasActivity.rows[0]?.exists);

  return NextResponse.json({
    isNewUser: false,
    onboardingCompleted,
    user
  });
}
