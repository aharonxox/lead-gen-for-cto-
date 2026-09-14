import { createFileRoute } from "@tanstack/react-router";
import {
  MIN_PASSWORD_LENGTH,
  createSessionCookie,
  hashPassword,
} from "~/lib/auth";
import { getStorage } from "~/lib/storage";

// First-run "set your password" — only works while no user exists.
// Replaces the old hard-coded PIN (nothing credentials-shaped in source).
export const Route = createFileRoute("/api/auth/setup")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const storage = await getStorage();
        if (await storage.hasUser()) {
          return Response.json(
            { error: "A password is already set. Log in instead." },
            { status: 409 },
          );
        }
        const body = (await request.json().catch(() => ({}))) as {
          password?: string;
        };
        const password = (body.password ?? "").trim();
        if (password.length < MIN_PASSWORD_LENGTH) {
          return Response.json(
            { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
            { status: 400 },
          );
        }
        const user = await storage.createUser("owner", hashPassword(password));
        const cookie = await createSessionCookie(user.id, request);
        return Response.json(
          { ok: true, authenticated: true },
          { headers: { "Set-Cookie": cookie } },
        );
      },
    },
  },
});
