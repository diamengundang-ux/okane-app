import { NextResponse } from "next/server";

import { findOrCreateUserByEmail } from "@/server/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const info = (await res.json()) as { email?: string; name?: string; aud?: string };
    const email = typeof info.email === "string" ? info.email : "";
    const name = typeof info.name === "string" ? info.name : "";
    const aud = typeof info.aud === "string" ? info.aud : "";
    if (!email || !name) {
      return NextResponse.json({ error: "Token missing profile" }, { status: 401 });
    }

    const expectedAud = (process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();
    if (expectedAud && aud && aud !== expectedAud) {
      return NextResponse.json({ error: "Token audience mismatch" }, { status: 401 });
    }

    const user = await findOrCreateUserByEmail({ email, name });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
