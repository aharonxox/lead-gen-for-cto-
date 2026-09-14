import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserId } from "~/lib/auth";
import { getStorage } from "~/lib/storage";

// Public: tells the client whether to show first-run password setup, the
// login screen, or the dashboard — and, when signed in, WHICH user (shown in
// the header; every signed-up user shares the one team pipeline).
export const Route = createFileRoute("/api/auth/state")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const storage = await getStorage();
        const hasUser = await storage.hasUser();
        const userId = await getSessionUserId(request);
        let username: string | null = null;
        if (userId != null) {
          username = (await storage.getUserById(userId))?.username ?? null;
        }
        return Response.json({ hasUser, authenticated: userId != null, username });
      },
    },
  },
});
