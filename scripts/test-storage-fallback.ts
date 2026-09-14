// Resilience test for the storage layer (run: bun run scripts/test-storage-fallback.ts).
// 1) DATABASE_URL set but unreachable at boot -> getStorage() serves SQLite.
// 2) A wrapped PostgresStorage failing mid-run -> proxy degrades to SQLite.
export {};
process.env.DATABASE_URL = "postgres://u:p@127.0.0.1:59999/db"; // nothing listens here
process.env.SQLITE_PATH = "/tmp/pb-fallback-test.db";

const { getStorage, withSqliteFallback } = await import("../src/lib/storage/index");
const s = await getStorage();
console.log("1 kind after failed boot probe:", s.kind, "(expect sqlite)");
const created = await s.createUser("tuser", "hash");
console.log("2 created via fallback:", created);
console.log(
  "3 case-insensitive lookup:",
  (await s.getUserByUsername("TUSER"))?.username ?? "MISSING",
  "| byId:",
  (await s.getUserById(created.id))?.username ?? "MISSING",
);

// Mid-run failover: a PostgresStorage that CAN'T connect, wrapped in the proxy.
const { PostgresStorage } = await import("../src/lib/storage/pg");
const resilient = withSqliteFallback(new PostgresStorage());
console.log("4 wrapped kind:", resilient.kind, "(expect postgres — transparent proxy)");
await resilient.ensureSchema(); // connection fails -> one clear log -> SQLite
console.log("5 createUser after mid-run failover:", await resilient.createUser("tuser2", "h2"));
console.log(
  "6 data visible through plain SQLite backend:",
  (await s.getUserByUsername("tuser2"))?.username ?? "MISSING",
);
console.log("RESILIENCE TEST DONE");
process.exit(0);
