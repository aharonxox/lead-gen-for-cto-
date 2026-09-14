// SQLite storage backend — the zero-config fallback so the app runs with NO
// owner-provided env vars (Feasibility verdict, P0-1 + item 11). Uses the
// built-in node:sqlite driver (Node >= 22); no native dependencies.
//
// When DATABASE_URL is present the Postgres backend in ./pg.ts is used instead
// (see ./index.ts). Both implement the same Storage interface.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  CallEntry,
  CallOutcome,
  Lead,
  LeadStatus,
  NewLeadInput,
  SearchPairState,
  Stats,
} from "../types";
import type { Storage } from "./types";

function resolveDbFile(): string {
  const explicit = process.env.SQLITE_PATH;
  if (explicit) return explicit;
  const base = process.cwd();
  // /tmp fallback for read-only filesystems (e.g. some serverless hosts that
  // run without DATABASE_URL) — data still survives within the instance.
  try {
    const dir = path.join(base, ".data");
    mkdirSync(dir, { recursive: true });
    return path.join(dir, "crm.db");
  } catch {
    const dir = path.join("/tmp", "peptidebridge-data");
    mkdirSync(dir, { recursive: true });
    return path.join(dir, "crm.db");
  }
}

export class SQLiteStorage implements Storage {
  readonly kind = "sqlite" as const;
  private db: DatabaseSync;
  private schemaReady = false;

  constructor(file?: string) {
    this.db = new DatabaseSync(file ?? resolveDbFile());
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  ensureSchema(): void {
    if (this.schemaReady) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        place_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        website TEXT,
        status TEXT NOT NULL DEFAULT 'new'
          CHECK (status IN ('new','green','yellow','red')),
        follow_up_on TEXT,
        seq INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS call_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        called_at TEXT NOT NULL,
        outcome TEXT NOT NULL
          CHECK (outcome IN ('connected','voicemail','callback_booked','no_answer')),
        note TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_call_log_lead ON call_log(lead_id, called_at);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS processed_place_ids (
        place_id TEXT PRIMARY KEY,
        at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS search_pairs (
        city TEXT NOT NULL,
        keyword TEXT NOT NULL,
        last_searched_at TEXT,
        new_leads INTEGER NOT NULL DEFAULT 0,
        exhausted INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (city, keyword)
      );
    `);
    // Phase 2 migration: "call back on" date per lead. Older databases created
    // before this column existed get it via ALTER; SQLite's ADD COLUMN has no
    // IF NOT EXISTS, so a duplicate-column error simply means it's already there.
    try {
      this.db.exec("ALTER TABLE leads ADD COLUMN follow_up_on TEXT");
    } catch {
      // column already exists
    }
    this.schemaReady = true;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private iso(v: unknown): string | null {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : d.toISOString();
  }

  // ---- users / sessions ----

  hasUser(): boolean {
    this.ensureSchema();
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM users").get() as {
      n: number;
    };
    return row.n > 0;
  }

  createUser(username: string, passwordHash: string) {
    this.ensureSchema();
    const res = this.db
      .prepare(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
      )
      .run(username, passwordHash, this.now());
    return { id: Number(res.lastInsertRowid), username };
  }

  getUser() {
    this.ensureSchema();
    const row = this.db
      .prepare("SELECT id, username, password_hash FROM users ORDER BY id LIMIT 1")
      .get() as { id: number; username: string; password_hash: string } | undefined;
    if (!row) return null;
    return { id: row.id, username: row.username, passwordHash: row.password_hash };
  }

  getUserByUsername(username: string) {
    this.ensureSchema();
    // Case-insensitive: logins shouldn't hinge on caps.
    const row = this.db
      .prepare(
        "SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE LIMIT 1",
      )
      .get(username) as { id: number; username: string; password_hash: string } | undefined;
    if (!row) return null;
    return { id: row.id, username: row.username, passwordHash: row.password_hash };
  }

  getUserById(id: number) {
    this.ensureSchema();
    const row = this.db
      .prepare("SELECT id, username, password_hash FROM users WHERE id = ? LIMIT 1")
      .get(id) as { id: number; username: string; password_hash: string } | undefined;
    if (!row) return null;
    return { id: row.id, username: row.username, passwordHash: row.password_hash };
  }

  createSession(tokenHash: string, userId: number, expiresAt: Date): void {
    this.ensureSchema();
    this.db
      .prepare(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run(tokenHash, userId, this.now(), expiresAt.toISOString());
    this.db
      .prepare("DELETE FROM sessions WHERE expires_at < ?")
      .run(this.now());
  }

  getSession(tokenHash: string): { userId: number; expiresAt: Date } | null {
    this.ensureSchema();
    const row = this.db
      .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
      .get(tokenHash) as { user_id: number; expires_at: string } | undefined;
    if (!row) return null;
    const expiresAt = new Date(row.expires_at);
    if (expiresAt.getTime() < Date.now()) {
      this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
      return null;
    }
    return { userId: row.user_id, expiresAt };
  }

  deleteSession(tokenHash: string): void {
    this.ensureSchema();
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }

  // ---- leads ----

  listLeads(): Lead[] {
    this.ensureSchema();
    const rows = this.db
      .prepare(
        `SELECT l.*,
           (SELECT COUNT(*) FROM call_log c WHERE c.lead_id = l.id) AS call_count,
           (SELECT MAX(c.called_at) FROM call_log c WHERE c.lead_id = l.id) AS last_call_at,
           (SELECT c.note FROM call_log c WHERE c.lead_id = l.id
              ORDER BY c.called_at DESC, c.id DESC LIMIT 1) AS last_note
         FROM leads l ORDER BY l.seq DESC, l.created_at DESC`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToLead(r));
  }

  private rowToLead(r: Record<string, unknown>): Lead {
    return {
      id: String(r.id),
      placeId: String(r.place_id),
      name: String(r.name),
      address: (r.address as string) ?? null,
      phone: (r.phone as string) ?? null,
      website: (r.website as string) ?? null,
      status: r.status as LeadStatus,
      followUpOn: (r.follow_up_on as string) ?? null,
      createdAt: this.iso(r.created_at) as string,
      callCount: Number(r.call_count ?? 0),
      lastCallAt: this.iso(r.last_call_at),
      lastNote: (r.last_note as string) ?? null,
    };
  }

  updateLeadStatus(id: string, status: LeadStatus, followUpOn?: string | null): void {
    this.ensureSchema();
    if (followUpOn === undefined) {
      this.db
        .prepare("UPDATE leads SET status = ?, updated_at = ? WHERE id = ?")
        .run(status, this.now(), id);
    } else {
      this.db
        .prepare("UPDATE leads SET status = ?, follow_up_on = ?, updated_at = ? WHERE id = ?")
        .run(status, followUpOn, this.now(), id);
    }
  }

  setFollowUp(id: string, followUpOn: string | null): void {
    this.ensureSchema();
    this.db
      .prepare("UPDATE leads SET follow_up_on = ?, updated_at = ? WHERE id = ?")
      .run(followUpOn, this.now(), id);
  }

  insertLeads(leads: NewLeadInput[]): Lead[] {
    this.ensureSchema();
    if (leads.length === 0) return [];
    const inserted: Lead[] = [];
    this.db.exec("BEGIN");
    try {
      const nextSeq = () => {
        const row = this.db
          .prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS s FROM leads")
          .get() as { s: number };
        return row.s;
      };
      for (const l of leads) {
        const id = `lead_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        const now = this.now();
        this.db
          .prepare(
            `INSERT INTO leads (id, place_id, name, address, phone, website, status, seq, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
          )
          .run(id, l.placeId, l.name, l.address, l.phone, l.website, nextSeq(), now, now);
        this.db
          .prepare("INSERT OR IGNORE INTO processed_place_ids (place_id, at) VALUES (?, ?)")
          .run(l.placeId, now);
        inserted.push({
          id,
          placeId: l.placeId,
          name: l.name,
          address: l.address,
          phone: l.phone,
          website: l.website,
          status: "new",
          followUpOn: null,
          createdAt: now,
          callCount: 0,
          lastCallAt: null,
          lastNote: null,
        });
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return inserted;
  }

  async filterUnprocessed(placeIds: string[]): Promise<Set<string>> {
    this.ensureSchema();
    const out = new Set<string>();
    for (let i = 0; i < placeIds.length; i += 500) {
      const chunk = placeIds.slice(i, i + 500);
      const placeholders = chunk.map(() => "?").join(",");
      const rows = this.db
        .prepare(
          `SELECT place_id FROM processed_place_ids WHERE place_id IN (${placeholders})`,
        )
        .all(...chunk) as Array<{ place_id: string }>;
      for (const r of rows) out.add(r.place_id);
    }
    return out;
  }

  async markProcessed(placeIds: string[]): Promise<void> {
    this.ensureSchema();
    if (placeIds.length === 0) return;
    const now = this.now();
    this.db.exec("BEGIN");
    try {
      const stmt = this.db.prepare(
        "INSERT OR IGNORE INTO processed_place_ids (place_id, at) VALUES (?, ?)",
      );
      for (const id of placeIds) stmt.run(id, now);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  // ---- call log ----

  addCall(leadId: string, outcome: CallOutcome, note: string, at?: Date): CallEntry {
    this.ensureSchema();
    const calledAt = (at ?? new Date()).toISOString();
    const res = this.db
      .prepare(
        "INSERT INTO call_log (lead_id, called_at, outcome, note) VALUES (?, ?, ?, ?)",
      )
      .run(leadId, calledAt, outcome, note);
    this.db
      .prepare("UPDATE leads SET updated_at = ? WHERE id = ?")
      .run(this.now(), leadId);
    return {
      id: Number(res.lastInsertRowid),
      leadId,
      at: calledAt,
      outcome,
      note,
    };
  }

  listCalls(leadId: string): CallEntry[] {
    this.ensureSchema();
    const rows = this.db
      .prepare(
        "SELECT id, lead_id, called_at, outcome, note FROM call_log WHERE lead_id = ? ORDER BY called_at DESC, id DESC",
      )
      .all(leadId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      leadId: String(r.lead_id),
      at: this.iso(r.called_at) as string,
      outcome: r.outcome as CallOutcome,
      note: String(r.note ?? ""),
    }));
  }

  listAllCalls(): CallEntry[] {
    this.ensureSchema();
    const rows = this.db
      .prepare(
        "SELECT id, lead_id, called_at, outcome, note FROM call_log ORDER BY called_at ASC, id ASC",
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: Number(r.id),
      leadId: String(r.lead_id),
      at: this.iso(r.called_at) as string,
      outcome: r.outcome as CallOutcome,
      note: String(r.note ?? ""),
    }));
  }

  // ---- settings ----

  getSetting(key: string): string | null {
    this.ensureSchema();
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  setSetting(key: string, value: string): void {
    this.ensureSchema();
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  // ---- search pairs ----

  upsertSearchPair(
    city: string,
    keyword: string,
    newLeads: number,
    exhausted: boolean,
  ): void {
    this.ensureSchema();
    this.db
      .prepare(
        `INSERT INTO search_pairs (city, keyword, last_searched_at, new_leads, exhausted)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(city, keyword) DO UPDATE SET
           last_searched_at = excluded.last_searched_at,
           new_leads = search_pairs.new_leads + excluded.new_leads,
           exhausted = excluded.exhausted`,
      )
      .run(city, keyword, this.now(), newLeads, exhausted ? 1 : 0);
  }

  listSearchPairs(): SearchPairState[] {
    this.ensureSchema();
    const rows = this.db
      .prepare("SELECT * FROM search_pairs")
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      city: String(r.city),
      keyword: String(r.keyword),
      lastSearchedAt: this.iso(r.last_searched_at),
      newLeadsFound: Number(r.new_leads ?? 0),
      exhausted: Number(r.exhausted ?? 0) === 1,
    }));
  }

  // ---- stats ----

  stats(): Stats {
    this.ensureSchema();
    const counts: Record<LeadStatus, number> = {
      new: 0,
      green: 0,
      yellow: 0,
      red: 0,
    };
    const rows = this.db
      .prepare("SELECT status, COUNT(*) AS n FROM leads GROUP BY status")
      .all() as Array<{ status: LeadStatus; n: number }>;
    for (const r of rows) counts[r.status] = r.n;
    const processed = this.db
      .prepare("SELECT COUNT(*) AS n FROM processed_place_ids")
      .get() as { n: number };
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const dials = this.db
      .prepare("SELECT COUNT(*) AS n FROM call_log WHERE called_at >= ?")
      .get(midnight.toISOString()) as { n: number };
    return {
      totalFetched: processed.n,
      activeInPipeline: counts.new + counts.green + counts.yellow,
      counts,
      dialsToday: dials.n,
    };
  }
}
