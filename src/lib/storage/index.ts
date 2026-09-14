// Storage selector with a hard resilience guarantee:
//
//  - No DATABASE_URL  → the built-in SQLite fallback (zero owner-provided env
//    vars; Feasibility verdict, P0-1 + item 11).
//  - DATABASE_URL set → Postgres (standard TCP via postgres.js, works with
//    Supabase pooler hosts). Two layers of protection so a dead database can
//    never take the CRM down:
//      1. At startup a real connection probe (schema ensure) runs once; if it
//         fails we log ONE clear error and serve everything from SQLite.
//      2. If Postgres dies mid-run (e.g. a Supabase free-tier project pauses),
//         the wrapper below fails over to SQLite instead of 500-ing requests.
//    Writes made while Postgres is down land in SQLite and are not mirrored
//    back — that is the accepted tradeoff for never being down.
import { PostgresStorage } from "./pg";
import { SQLiteStorage } from "./sqlite";
import type { Storage } from "./types";

let instance: Storage | null = null;
let resolving: Promise<Storage> | null = null;

export async function getStorage(): Promise<Storage> {
  if (instance) return instance;
  if (!resolving) resolving = resolveStorage();
  return resolving;
}

async function resolveStorage(): Promise<Storage> {
  if (!process.env.DATABASE_URL) {
    instance = new SQLiteStorage();
    return instance;
  }
  const pg = new PostgresStorage();
  try {
    await pg.ensureSchema(); // first real query = connection probe
    instance = withSqliteFallback(pg);
    return instance;
  } catch (err) {
    console.error(
      `[storage] DATABASE_URL is set but Postgres is unreachable — falling back to SQLite so the CRM stays up. ` +
        `Writes made while Postgres is down go to SQLite and are NOT copied back. Cause: ${errorMessage(err)}`,
    );
    instance = new SQLiteStorage();
    return instance;
  }
}

// Wraps every method of the Postgres backend: on a connection-class failure it
// logs once, switches to SQLite for the rest of the process lifetime, and
// re-runs the same call there. Exported for the resilience test script.
export function withSqliteFallback(pg: PostgresStorage): Storage {
  let fallback: SQLiteStorage | null = null;
  let degraded = false;

  return new Proxy(pg, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      // Non-method properties (e.g. `kind`) pass straight through.
      if (typeof orig !== "function") return orig;
      return async (...args: unknown[]) => {
        if (!degraded) {
          try {
            return await (orig as (...a: unknown[]) => unknown).apply(target, args);
          } catch (err) {
            if (!isConnectionError(err)) throw err;
            degraded = true;
            console.error(
              `[storage] Postgres connection failed mid-run (${errorMessage(err)}) — ` +
                `serving data from SQLite until the app restarts.`,
            );
          }
        }
        fallback ??= new SQLiteStorage();
        return await (fallback as unknown as Record<string, (...a: unknown[]) => unknown>)[
          prop as string
        ](...args);
      };
    },
  }) as Storage;
}

function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code ?? "";
  if (
    [
      "ENOTFOUND",
      "EAI_AGAIN",
      "ECONNREFUSED",
      "ECONNRESET",
      "ECONNABORTED",
      "ETIMEDOUT",
      "EPIPE",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "ERR_SOCKET_CONNECTION_TIMEOUT",
    ].includes(code)
  ) {
    return true;
  }
  // Postgres SQLSTATE connection-failure classes + postgres.js wording.
  const msg = errorMessage(err);
  return (
    /^(08|57P01|57P02|57P03|53300)/.test(code) ||
    /failed to connect|connection (terminated|refused|reset|closed)|connect timeout|socket|too many connections|server closed|pool exhausted/i.test(
      msg,
    )
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export type { Storage } from "./types";
