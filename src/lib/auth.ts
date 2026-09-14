// Real login — replaces the old hard-coded PIN (analysis risk #2).
// bcrypt-hashed password, HttpOnly + SameSite session cookie backed by a
// server-side session row, and a light in-memory lockout on failed logins.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getStorage } from "./storage";

export const SESSION_COOKIE = "pb_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function cookieAttrs(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "";
  const secure = proto.split(",")[0].trim() === "https" ? "; Secure" : "";
  return `; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`;
}

export async function createSessionCookie(
  userId: number,
  request: Request,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const storage = await getStorage();
  await storage.createSession(hashToken(token), userId, new Date(Date.now() + SESSION_TTL_MS));
  return `${SESSION_COOKIE}=${token}${cookieAttrs(request)}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function getSessionUserId(request: Request): Promise<number | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const storage = await getStorage();
  const session = await storage.getSession(hashToken(token));
  return session ? session.userId : null;
}

function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;,\\s]+)`));
  return match ? match[1] : null;
}

// Deletes the session row for the caller's cookie (logout).
export async function destroySession(request: Request): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  const storage = await getStorage();
  await storage.deleteSession(hashToken(token));
}

// Returns the session's actual user or null; API routes use this as the auth
// gate. Multi-user: the session stores the user id, so look THAT user up.
export async function requireUser(request: Request) {
  const id = await getSessionUserId(request);
  if (id == null) return null;
  const storage = await getStorage();
  return storage.getUserById(id);
}

// ---- sign-up validation (shared by /api/auth/signup) ----
// 3–32 chars, starts alphanumeric; then letters, digits, dot, dash, underscore.
export const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,31}$/;

// ---- light rate limiting (in-memory; resets on server restart) ----
// 5 consecutive failures lock THAT username's login for 5 minutes. Multi-user
// now, so the counter is per-username (lowercased) — one rep fat-fingering
// their password never locks the owner out. Blank-username logins (the legacy
// owner flow) share one "(blank)" key so they can't be used to brute the
// first account either.
const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;
const lockouts = new Map<string, { failures: number; lockedUntil: number }>();

function lockKey(username?: string | null): string {
  const u = (username ?? "").trim().toLowerCase();
  return u || "(blank)";
}

export function loginLockRemainingSec(username?: string | null): number {
  const entry = lockouts.get(lockKey(username));
  if (!entry || entry.lockedUntil <= Date.now()) return 0;
  return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
}

export function recordLoginFailure(username?: string | null): void {
  const key = lockKey(username);
  const entry = lockouts.get(key) ?? { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.failures = 0;
  }
  lockouts.set(key, entry);
}

export function recordLoginSuccess(username?: string | null): void {
  lockouts.delete(lockKey(username));
}
