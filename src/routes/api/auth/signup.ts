import { createFileRoute } from "@tanstack/react-router";
import {
  MIN_PASSWORD_LENGTH,
  USERNAME_RE,
  createSessionCookie,
  hashPassword,
} from "~/lib/auth";
import { getStorage } from "~/lib/storage";

// Sign-up — creates an additional team member ("a normal sign in and sign up").
// Every signed-up user shares the ONE team pipeline: leads and the call log
// are team-wide; there are no roles or per-user scoping yet.
// First-run setup (/api/auth/setup) stays the only way the FIRST user
// ("owner") is created; this route only runs once at least one user exists.
export const Route = createFileRoute("/api/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const storage = await getStorage();
        if (!(await storage.hasUser())) {
          return Response.json(
            { error: "Complete first-run setup before creating accounts." },
            { status: 409 },
          );
        }
        const body = (await request.json().catch(() => ({}))) as {
          username?: string;
          password?: string;
          confirmPassword?: string;
        };
        const username = (body.username ?? "").trim();
        const password = (body.password ?? "").trim();
        const confirmPassword = (body.confirmPassword ?? "").trim();

        if (!USERNAME_RE.test(username)) {
          return Response.json(
            {
              error:
                "Username must be 3–32 characters: start with a letter or number, then letters, numbers, dots, dashes or underscores.",
            },
            { status: 400 },
          );
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
          return Response.json(
            { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
            { status: 400 },
          );
        }
        if (password !== confirmPassword) {
          return Response.json(
            { error: "Passwords don't match." },
            { status: 400 },
          );
        }
        if (await storage.getUserByUsername(username)) {
          return Response.json(
            { error: "That username is already taken." },
            { status: 409 },
          );
        }
        let user: { id: number; username: string };
        try {
          user = await storage.createUser(username, hashPassword(password));
        } catch {
          // unique-constraint backstop (race between check and insert)
          return Response.json(
            { error: "That username is already taken." },
            { status: 409 },
          );
        }
        const cookie = await createSessionCookie(user.id, request);
        return Response.json(
          { ok: true, authenticated: true, username: user.username },
          { headers: { "Set-Cookie": cookie } },
        );
      },
    },
  },
});
