import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookie, destroySession } from "~/lib/auth";

// Logout — deletes the server-side session row and clears the cookie.
export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        await destroySession(request);
        return Response.json(
          { ok: true },
          { headers: { "Set-Cookie": clearSessionCookie() } },
        );
      },
    },
  },
});
