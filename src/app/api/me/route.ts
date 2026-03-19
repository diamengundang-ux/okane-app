import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { query } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

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
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });

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
    return NextResponse.json(
      { isNewUser: true, onboardingCompleted: false, user: inserted.rows[0] },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const user = found.rows[0];
  const [userTxCount, userReflCount, demoTxCount, demoReflCount, realUsersCount] = await Promise.all([
    query<{ count: string }>("select count(*)::text as count from transactions where user_id = $1", [user.id]),
    query<{ count: string }>("select count(*)::text as count from reflections where user_id = $1", [user.id]),
    query<{ count: string }>("select count(*)::text as count from transactions where user_id = $1", [DEMO_USER_ID]),
    query<{ count: string }>("select count(*)::text as count from reflections where user_id = $1", [DEMO_USER_ID]),
    query<{ count: string }>("select count(*)::text as count from users where id <> $1", [DEMO_USER_ID])
  ]);

  const userHasAny =
    Number(userTxCount.rows[0]?.count ?? "0") > 0 || Number(userReflCount.rows[0]?.count ?? "0") > 0;
  const demoHasAny =
    Number(demoTxCount.rows[0]?.count ?? "0") > 0 || Number(demoReflCount.rows[0]?.count ?? "0") > 0;
  const isOnlyRealUser = Number(realUsersCount.rows[0]?.count ?? "0") === 1;

  if (!userHasAny && demoHasAny && isOnlyRealUser) {
    await query("update transactions set user_id = $1 where user_id = $2", [user.id, DEMO_USER_ID]);
    await query("update reflections set user_id = $1 where user_id = $2", [user.id, DEMO_USER_ID]);
    await query("update users set onboarding_completed = true where id = $1", [user.id]);
    await query("delete from users where id = $1", [DEMO_USER_ID]);
    user.onboarding_completed = true;
  }

  const hasActivity = await query<{ exists: boolean }>(
    "select exists(select 1 from transactions where user_id = $1) or exists(select 1 from reflections where user_id = $1) as exists",
    [user.id]
  );
  const onboardingCompleted = Boolean(user.onboarding_completed) || Boolean(hasActivity.rows[0]?.exists);

  return NextResponse.json({
    isNewUser: false,
    onboardingCompleted,
    user
  }, { headers: { "Cache-Control": "no-store" } });
}
