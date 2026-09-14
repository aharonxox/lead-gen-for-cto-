import postgres from "postgres";

/**
 * Server-only handle to the team's database over standard Postgres TCP
 * (postgres.js — works with Supabase pooler hosts, Neon, RDS, any Postgres).
 * The connection string comes from `DATABASE_URL`, which the owner connects via
 * the database card and which is injected into the sandbox and passed to the live
 * host on publish. Resolved lazily (per call, not at module load) so the site
 * still builds and serves before a database is connected — the error only
 * surfaces if a query actually runs without `DATABASE_URL`.
 *
 * postgres.js hands back a connection POOL, so the handle is cached per
 * connection string — never construct one per query.
 *
 * Use it only inside a `createServerFn()` handler or an `src/routes/api/*` route
 * (never client code):
 *
 *   const getPosts = createServerFn().handler(async () => {
 *     const db = sql();
 *     const rows = await db`select id, title, created_at from posts`;
 *     // Timestamps arrive as JS Dates — ./lib/storage/pg.ts coerces them to
 *     // strings before anything goes to the client (React won't render Dates).
 *     return rows;
 *   });
 */
let cached: postgres.Sql | null = null;
let cachedUrl: string | null = null;

export const sql = (): postgres.Sql => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — connect a database (via the database card) before running queries.",
    );
  }
  if (cached && cachedUrl === url) return cached;
  // Transaction-poolers (Supabase Supavisor / PgBouncer) can't do named
  // prepared statements — disable them when the host smells like a pooler.
  const pooled = /pooler|pgbouncer|supavisor|supabase/i.test(url);
  cached = postgres(url, {
    // "prefer" negotiates SSL when the server supports it (Supabase requires
    // it) and still connects to local Postgres without TLS.
    ssl: /sslmode=disable/i.test(url) ? false : "prefer",
    prepare: pooled ? false : undefined,
    connect_timeout: 10,
    idle_timeout: 25,
    max: 10,
  });
  cachedUrl = url;
  return cached;
};
