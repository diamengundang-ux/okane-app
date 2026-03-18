import { ensureUser } from "@/server/users";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function getOrCreateRequestUser(request: Request) {
  const headerId = request.headers.get("x-user-id");
  const headerEmail = request.headers.get("x-user-email");
  const headerName = request.headers.get("x-user-name");

  if (headerId && headerEmail && headerName) {
    return ensureUser({ id: headerId, email: headerEmail, name: headerName });
  }

  return ensureUser({ id: DEMO_USER_ID, email: "demo@okane.local", name: "Demo" });
}
