export { pool, query, testDb } from "@/lib/db";

export function requireUserId(request: Request) {
  const id = request.headers.get("x-user-id");
  if (!id) return null;
  return id;
}
