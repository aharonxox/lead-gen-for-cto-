// Postgres storage backend — used whenever DATABASE_URL is present (Neon
// serverless Postgres over HTTP via the existing ~/db helper). This is the
// path team hosting and Vercel use once the owner connects a database.
//
// Same Storage contract as the SQLite fallback; see ./index.ts for selection.

import { sql as neonSql } from "~/db";
import type {
  CallEntry,
  CallOutcome,
  Lead,
  LeadStatus,
  NewLeadInput,
  SearchPairState,
  Stats,
} from "../types";
import type { Storage, StorageUser } from "./types";

type Row = Record<string, unknown>;

export class PostgresStorage implements Storage {
  readonly kind = "postgres" as const;

  private async q(text: string, params: unknown[] = []): Promise<Row[]> {
    const db = neonSql();
    // neon()'s TS surface is the tagged-template form; the array call form
    // (query, params) is supported at runtime — cast for the type checker.
    const query = db as unknown as (
      text: string,
      params: unknown[],
    ) => Promise<Row[]>;
    return await query(text, params);
  }

  private async one(text: string, params: unknown[] = []): Promise<Row | undefined> {
    const rows = await this.q(text, params);
    return rows[0];
  }

  private iso(v: unknown): string | null {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : d.toISOString();
  }

  async ensureSchema(): Promise<void> {
    await this.q(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await this.q(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )`);
    await this.q(`CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      place_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      website TEXT,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new','green','yellow','red')),
      seq BIGSERIAL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await this.q(`CREATE TABLE IF NOT EXISTS call_log (
      id SERIAL PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      outcome TEXT NOT NULL
        CHECK (outcome IN ('connected','voicemail','callback_booked','no_answer')),
      note TEXT NOT NULL DEFAULT ''
    )`);
    await this.q(
      "CREATE INDEX IF NOT EXISTS idx_call_log_lead ON call_log(lead_id, called_at DESC)",
    );
    await this.q(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    await this.q(`CREATE TABLE IF NOT EXISTS processed_place_ids (
      place_id TEXT PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await this.q(`CREATE TABLE IF NOT EXISTS search_pairs (
      city TEXT NOT NULL,
      keyword TEXT NOT NULL,
      last_searched_at TIMESTAMPTZ,
      new_leads INTEGER NOT NULL DEFAULT 0,
      exhausted BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (city, keyword)
    )`);
  }

  // ---- users / sessions ----

  async hasUser(): Promise<boolean> {
    await this.ensureSchema();
    const row = await this.one("SELECT COUNT(*)::int AS n FROM users");
    return Number(row?.n ?? 0) > 0;
  }

  async createUser(username: string, passwordHash: string) {
    await this.ensureSchema();
    const row = await this.one(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username",
      [username, passwordHash],
    );
    return { id: Number(row!.id), username: String(row!.username) };
  }

  async getUser(): Promise<StorageUser | null> {
    await this.ensureSchema();
    const row = await this.one(
      "SELECT id, username, password_hash FROM users ORDER BY id LIMIT 1",
    );
    if (!row) return null;
    return {
      id: Number(row.id),
      username: String(row.username),
      passwordHash: String(row.password_hash),
    };
  }

  async createSession(tokenHash: string, userId: number, expiresAt: Date) {
    await this.ensureSchema();
    await this.q(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
      [tokenHash, userId, expiresAt.toISOString()],
    );
    await this.q("DELETE FROM sessions WHERE expires_at < now()");
  }

  async getSession(tokenHash: string) {
    await this.ensureSchema();
    const row = await this.one(
      "SELECT user_id, expires_at FROM sessions WHERE token_hash = $1",
      [tokenHash],
    );
    if (!row) return null;
    const expiresAt = new Date(String(row.expires_at));
    if (expiresAt.getTime() < Date.now()) {
      await this.q("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
      return null;
    }
    return { userId: Number(row.user_id), expiresAt };
  }

  async deleteSession(tokenHash: string) {
    await this.ensureSchema();
    await this.q("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  }

  // ---- leads ----

  private rowToLead(r: Row): Lead {
    return {
      id: String(r.id),
      placeId: String(r.place_id),
      name: String(r.name),
      address: (r.address as string) ?? null,
      phone: (r.phone as string) ?? null,
      website: (r.website as string) ?? null,
      status: r.status as LeadStatus,
      createdAt: this.iso(r.created_at) as string,
      callCount: Number(r.call_count ?? 0),
      lastCallAt: this.iso(r.last_call_at),
      lastNote: (r.last_note as string) ?? null,
    };
  }

  async listLeads(): Promise<Lead[]> {
    await this.ensureSchema();
    const rows = await this.q(`SELECT l.*,
        (SELECT COUNT(*)::int FROM call_log c WHERE c.lead_id = l.id) AS call_count,
        (SELECT MAX(c.called_at) FROM call_log c WHERE c.lead_id = l.id) AS last_call_at,
        (SELECT c.note FROM call_log c WHERE c.lead_id = l.id
           ORDER BY c.called_at DESC, c.id DESC LIMIT 1) AS last_note
      FROM leads l ORDER BY l.seq DESC, l.created_at DESC`);
    return rows.map((r) => this.rowToLead(r));
  }

  async updateLeadStatus(id: string, status: LeadStatus) {
    await this.ensureSchema();
    await this.q("UPDATE leads SET status = $1, updated_at = now() WHERE id = $2", [
      status,
      id,
    ]);
  }

  async insertLeads(leads: NewLeadInput[]): Promise<Lead[]> {
    await this.ensureSchema();
    const inserted: Lead[] = [];
    for (const l of leads) {
      const row = await this.one(
        `INSERT INTO leads (id, place_id, name, address, phone, website, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'new')
         ON CONFLICT (place_id) DO NOTHING
         RETURNING id, place_id, name, address, phone, website, status, created_at`,
        [
          `lead_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
          l.placeId,
          l.name,
          l.address,
          l.phone,
          l.website,
        ],
      );
      if (!row) continue; // raced with another insert; place_id unique backstop
      await this.q(
        "INSERT INTO processed_place_ids (place_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [l.placeId],
      );
      inserted.push(this.rowToLead(row));
    }
    return inserted;
  }

  async filterUnprocessed(placeIds: string[]): Promise<Set<string>> {
    await this.ensureSchema();
    const out = new Set<string>();
    for (let i = 0; i < placeIds.length; i += 500) {
      const chunk = placeIds.slice(i, i + 500);
      const rows = await this.q(
        "SELECT place_id FROM processed_place_ids WHERE place_id = ANY($1::text[])",
        [chunk],
      );
      for (const r of rows) out.add(String(r.place_id));
    }
    return out;
  }

  async markProcessed(placeIds: string[]): Promise<void> {
    await this.ensureSchema();
    if (placeIds.length === 0) return;
    for (let i = 0; i < placeIds.length; i += 500) {
      const chunk = placeIds.slice(i, i + 500);
      await this.q(
        "INSERT INTO processed_place_ids (place_id) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING",
        [chunk],
      );
    }
  }

  // ---- call log ----

  async addCall(leadId: string, outcome: CallOutcome, note: string, at?: Date) {
    await this.ensureSchema();
    const row = await this.one(
      "INSERT INTO call_log (lead_id, called_at, outcome, note) VALUES ($1, $2, $3, $4) RETURNING id, lead_id, called_at, outcome, note",
      [leadId, (at ?? new Date()).toISOString(), outcome, note],
    );
    await this.q("UPDATE leads SET updated_at = now() WHERE id = $1", [leadId]);
    return {
      id: Number(row!.id),
      leadId,
      at: this.iso(row!.called_at) as string,
      outcome,
      note,
    } satisfies CallEntry;
  }

  async listCalls(leadId: string): Promise<CallEntry[]> {
    await this.ensureSchema();
    const rows = await this.q(
      "SELECT id, lead_id, called_at, outcome, note FROM call_log WHERE lead_id = $1 ORDER BY called_at DESC, id DESC",
      [leadId],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      leadId: String(r.lead_id),
      at: this.iso(r.called_at) as string,
      outcome: r.outcome as CallOutcome,
      note: String(r.note ?? ""),
    }));
  }

  // ---- settings ----

  async getSetting(key: string): Promise<string | null> {
    await this.ensureSchema();
    const row = await this.one("SELECT value FROM settings WHERE key = $1", [key]);
    return row ? String(row.value) : null;
  }

  async setSetting(key: string, value: string) {
    await this.ensureSchema();
    await this.q(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }

  // ---- search pairs ----

  async upsertSearchPair(
    city: string,
    keyword: string,
    newLeads: number,
    exhausted: boolean,
  ) {
    await this.ensureSchema();
    await this.q(
      `INSERT INTO search_pairs (city, keyword, last_searched_at, new_leads, exhausted)
       VALUES ($1, $2, now(), $3, $4)
       ON CONFLICT (city, keyword) DO UPDATE SET
         last_searched_at = excluded.last_searched_at,
         new_leads = search_pairs.new_leads + excluded.new_leads,
         exhausted = excluded.exhausted`,
      [city, keyword, newLeads, exhausted],
    );
  }

  async listSearchPairs(): Promise<SearchPairState[]> {
    await this.ensureSchema();
    const rows = await this.q(
      "SELECT city, keyword, last_searched_at, new_leads, exhausted FROM search_pairs",
    );
    return rows.map((r) => ({
      city: String(r.city),
      keyword: String(r.keyword),
      lastSearchedAt: this.iso(r.last_searched_at),
      newLeadsFound: Number(r.new_leads ?? 0),
      exhausted: r.exhausted === true,
    }));
  }

  // ---- stats ----

  async stats(): Promise<Stats> {
    await this.ensureSchema();
    const counts: Record<LeadStatus, number> = {
      new: 0,
      green: 0,
      yellow: 0,
      red: 0,
    };
    for (const r of await this.q(
      "SELECT status, COUNT(*)::int AS n FROM leads GROUP BY status",
    )) {
      counts[r.status as LeadStatus] = Number(r.n);
    }
    const processed = await this.one(
      "SELECT COUNT(*)::int AS n FROM processed_place_ids",
    );
    const dials = await this.one(
      "SELECT COUNT(*)::int AS n FROM call_log WHERE called_at >= date_trunc('day', now())",
    );
    return {
      totalFetched: Number(processed?.n ?? 0),
      activeInPipeline: counts.new + counts.green + counts.yellow,
      counts,
      dialsToday: Number(dials?.n ?? 0),
    };
  }
}
