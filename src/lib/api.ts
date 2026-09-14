import { getSessionUserId } from "./auth";

// Auth gate for API routes: returns a 401 Response when the caller has no
// valid session, or null when authenticated.
export async function requireAuth(request: Request): Promise<Response | null> {
  const userId = await getSessionUserId(request);
  if (userId == null) {
    return Response.json({ error: "Not logged in." }, { status: 401 });
  }
  return null;
}

export function maskKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}
