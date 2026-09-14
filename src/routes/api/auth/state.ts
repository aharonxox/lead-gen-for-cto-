import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserId } from "~/lib/auth";
import { getStorage } from "~/lib/storage";

// Public: tells the client whether to show first-run password setup, the
// login screen, or the dashboard.
export const Route = createFileRoute("/api/auth/state")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const storage = await getStorage();
        const hasUser = await storage.hasUser();
        const userId = await getSessionUserId(request);
        return Response.json({ hasUser, authenticated: userId != null });
      },
    },
  },
});
