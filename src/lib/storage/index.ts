// Storage selector: Postgres when DATABASE_URL is present (the ratified plan's
// storage target — works on team hosting and Vercel), otherwise the built-in
// SQLite fallback so the app runs with ZERO owner-provided env vars.
import { PostgresStorage } from "./pg";
import { SQLiteStorage } from "./sqlite";
import type { Storage } from "./types";

let instance: Storage | null = null;

export function getStorage(): Storage {
  if (instance) return instance;
  if (process.env.DATABASE_URL) {
    instance = new PostgresStorage();
  } else {
    instance = new SQLiteStorage();
  }
  return instance;
}

export type { Storage } from "./types";
