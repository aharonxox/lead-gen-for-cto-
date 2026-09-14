import { createFileRoute } from "@tanstack/react-router";
import {
  createSessionCookie,
  loginLockRemainingSec,
  recordLoginFailure,
  recordLoginSuccess,
  verifyPassword,
} from "~/lib/auth";
import { getStorage } from "~/lib/storage";

// Login — bcrypt verify against the stored hash, rate-limited.
export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const lockSec = loginLockRemainingSec();
        if (lockSec > 0) {
          return Response.json(
            {
              error: `Too many failed attempts. Try again in ${Math.ceil(lockSec / 60)} minute(s).`,
            },
            { status: 429 },
          );
        }
        const storage = await getStorage();
        const user = await storage.getUser();
        if (!user) {
          return Response.json(
            { error: "No password set yet — complete first-run setup." },
            { status: 409 },
          );
        }
        const body = (await request.json().catch(() => ({}))) as {
          password?: string;
        };
        if (!verifyPassword((body.password ?? "").trim(), user.passwordHash)) {
          recordLoginFailure();
          return Response.json({ error: "Incorrect password." }, { status: 401 });
        }
        recordLoginSuccess();
        const cookie = await createSessionCookie(user.id, request);
        return Response.json(
          { ok: true, authenticated: true },
          { headers: { "Set-Cookie": cookie } },
        );
      },
    },
  },
});
