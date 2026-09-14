import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BRAND, BRAND_TAGLINE } from "~/lib/brand";
import Dashboard from "~/app/dashboard";

export const Route = createFileRoute("/")({
  component: App,
});

type Phase = "loading" | "setup" | "login" | "signup" | "app";

type AuthState = { hasUser: boolean; authenticated: boolean; username: string | null };

function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [me, setMe] = useState<string | null>(null); // signed-in username
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // login form (username optional — blank means the first/owner account)
  const [loginUsername, setLoginUsername] = useState("");
  const [password, setPassword] = useState("");
  // sign-up form
  const [suUsername, setSuUsername] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  // first-run setup form
  const [confirm, setConfirm] = useState("");

  const refreshState = async (): Promise<AuthState | null> => {
    try {
      const res = await fetch("/api/auth/state");
      const data = (await res.json()) as AuthState;
      setMe(data.username);
      if (!data.hasUser) setPhase("setup");
      else if (data.authenticated) setPhase("app");
      else setPhase("login");
      return data;
    } catch {
      setError("Could not reach the server — retry shortly.");
      setPhase("login");
      return null;
    }
  };

  useEffect(() => {
    void refreshState();
  }, []);

  const submitSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Setup failed.");
      } else {
        setPassword("");
        setConfirm("");
        await refreshState();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername.trim(), password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Login failed.");
      } else {
        setPassword("");
        await refreshState();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (suPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (suPassword !== suConfirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: suUsername.trim(),
          password: suPassword,
          confirmPassword: suConfirm,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sign-up failed.");
      } else {
        setSuPassword("");
        setSuConfirm("");
        await refreshState();
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (phase === "app") {
    return <Dashboard onLogout={() => setPhase("login")} username={me} />;
  }

  const title =
    phase === "setup"
      ? "Set Your Password"
      : phase === "signup"
        ? "Create an Account"
        : "System Login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-[380px] rounded-xl bg-white p-[30px] text-center shadow-2xl">
        <h2 className="text-xl font-bold text-[#1f2937]">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {phase === "setup" ? (
            <>
              First run: choose a password for {BRAND} ({BRAND_TAGLINE}).
              <br />
              Minimum 8 characters. You'll log in with it from now on.
            </>
          ) : phase === "signup" ? (
            <>Add a teammate — everyone shares the same lead pipeline.</>
          ) : (
            <>Enter your username and password to unlock the dashboard.</>
          )}
        </p>
        {phase === "setup" ? (
          <form onSubmit={submitSetup}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              required
              autoFocus
              className="my-3 w-full rounded-md border border-gray-200 px-3 py-3 text-base"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              required
              className="mb-3 w-full rounded-md border border-gray-200 px-3 py-3 text-base"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-[#2563eb] py-3 text-base font-bold text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save & Unlock Dashboard"}
            </button>
          </form>
        ) : phase === "signup" ? (
          <form onSubmit={submitSignup}>
            <input
              type="text"
              value={suUsername}
              onChange={(e) => setSuUsername(e.target.value)}
              placeholder="Username"
              required
              autoFocus
              autoCapitalize="none"
              className="my-3 w-full rounded-md border border-gray-200 px-3 py-3 text-base"
            />
            <input
              type="password"
              value={suPassword}
              onChange={(e) => setSuPassword(e.target.value)}
              placeholder="Password (min 8 chars)"
              required
              className="mb-3 w-full rounded-md border border-gray-200 px-3 py-3 text-base"
            />
            <input
              type="password"
              value={suConfirm}
              onChange={(e) => setSuConfirm(e.target.value)}
              placeholder="Confirm password"
              required
              className="mb-3 w-full rounded-md border border-gray-200 px-3 py-3 text-base"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-[#2563eb] py-3 text-base font-bold text-white disabled:opacity-60"
            >
              {busy ? "Creating…" : "Sign Up & Open Dashboard"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPhase("login");
              }}
              className="mt-3 text-sm text-gray-500 underline hover:text-[#2563eb]"
            >
              Already have an account? Log in
            </button>
          </form>
        ) : (
          <form onSubmit={submitLogin}>
            <input
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="Username (leave blank for owner)"
              autoCapitalize="none"
              autoFocus
              className="my-3 w-full rounded-md border border-gray-200 px-3 py-3 text-base"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="mb-3 w-full rounded-md border border-gray-200 px-3 py-3 text-base"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-[#2563eb] py-3 text-base font-bold text-white disabled:opacity-60"
            >
              {busy ? "Checking…" : "Unlock Dashboard"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPhase("signup");
              }}
              className="mt-3 text-sm text-gray-500 underline hover:text-[#2563eb]"
            >
              New teammate? Create an account
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
