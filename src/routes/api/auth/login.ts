import { createFileRoute } from "@tanstack/react-router";
import {
  createSessionCookie,
  loginLockRemainingSec,
  recordLoginFailure,
  recordLoginSuccess,
  verifyPassword,
} from "~/lib/auth";
import { getStorage } from "~/lib/storage";

// Login — bcrypt verify against the stored hash, rate-limited per username.
// Multi-user: POST {username, password}. A blank username falls back to the
// first account (the original owner flow), so existing muscle memory and any
// old clients keep working untouched.
export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          username?: string;
          password?: string;
        };
        const username = (body.username ?? "").trim();
        const lockSec = loginLockRemainingSec(username);
        if (lockSec > 0) {
          return Response.json(
            {
              error: `Too many failed attempts. Try again in ${Math.ceil(lockSec / 60)} minute(s).`,
            },
            { status: 429 },
          );
        }
        const storage = await getStorage();
        const user = username
          ? await storage.getUserByUsername(username)
          : await storage.getUser();
        if (!user) {
          if (!username) {
            return Response.json(
              { error: "No password set yet — complete first-run setup." },
              { status: 409 },
            );
          }
          recordLoginFailure(username);
          return Response.json(
            { error: "Incorrect username or password." },
            { status: 401 },
          );
        }
        if (!verifyPassword((body.password ?? "").trim(), user.passwordHash)) {
          recordLoginFailure(username);
          return Response.json(
            { error: "Incorrect username or password." },
            { status: 401 },
          );
        }
        recordLoginSuccess(username);
        const cookie = await createSessionCookie(user.id, request);
        return Response.json(
          { ok: true, authenticated: true, username: user.username },
          { headers: { "Set-Cookie": cookie } },
        );
      },
    },
  },
});
