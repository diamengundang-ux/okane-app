import { query } from "@/server/db";

export type DbUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export async function ensureUser(input: { id: string; email: string; name: string }) {
  const existing = await query<DbUser>("select * from users where id = $1", [input.id]);
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await query<DbUser>(
    "insert into users (id, email, name) values ($1, $2, $3) returning *",
    [input.id, input.email, input.name]
  );
  return inserted.rows[0];
}

export async function findOrCreateUserByEmail(input: { email: string; name: string }) {
  const found = await query<DbUser>("select * from users where email = $1", [input.email]);
  if (found.rows[0]) return found.rows[0];

  const id = crypto.randomUUID();
  const inserted = await query<DbUser>(
    "insert into users (id, email, name) values ($1, $2, $3) returning *",
    [id, input.email, input.name]
  );
  return inserted.rows[0];
}
