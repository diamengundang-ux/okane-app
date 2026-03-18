import "server-only";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL tidak ditemukan");
}

function resolveSsl(connectionString: string) {
  const forced = process.env.DATABASE_SSL?.toLowerCase();
  if (forced === "true") return { rejectUnauthorized: false } as const;
  if (forced === "false") return undefined;

  try {
    const host = new URL(connectionString).hostname;
    if (host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com") || host.includes("supabase.com")) {
      return { rejectUnauthorized: false } as const;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL)
});

let tested = false;

async function ensureSchema() {
  await pool.query(`
    create table if not exists users (
      id uuid primary key,
      email text unique not null,
      name text not null,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists transactions (
      id uuid primary key,
      user_id uuid not null references users(id) on delete cascade,
      amount integer not null,
      type text not null check (type in ('income', 'expense')),
      category text not null,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create index if not exists idx_transactions_user_created_at on transactions(user_id, created_at desc)
  `);

  await pool.query(`
    create table if not exists reflections (
      id uuid primary key,
      user_id uuid not null references users(id) on delete cascade,
      sisa text not null default '',
      perbaikan text not null default '',
      kurangi text not null default '',
      combined_text text not null default '',
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create index if not exists idx_reflections_user_created_at on reflections(user_id, created_at desc)
  `);
}

export async function testDb() {
  if (tested) return;
  await pool.query("SELECT 1");
  await ensureSchema();
  tested = true;
}

export async function query<T = unknown>(text: string, params: unknown[] = []) {
  await testDb();
  const result = await pool.query(text, params);
  return result as { rows: T[] };
}
