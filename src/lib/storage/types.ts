// Storage contract shared by the SQLite fallback and the Postgres backend.
import type {
  CallEntry,
  CallOutcome,
  Lead,
  LeadStatus,
  NewLeadInput,
  SearchPairState,
  Stats,
} from "../types";

export interface StorageUser {
  id: number;
  username: string;
  passwordHash: string;
}

export interface Storage {
  readonly kind: "sqlite" | "postgres";
  ensureSchema(): void | Promise<void>;

  // users & sessions
  hasUser(): boolean | Promise<boolean>;
  createUser(
    username: string,
    passwordHash: string,
  ): { id: number; username: string } | Promise<{ id: number; username: string }>;
  getUser(): StorageUser | null | Promise<StorageUser | null>;
  getUserByUsername(
    username: string,
  ): StorageUser | null | Promise<StorageUser | null>;
  getUserById(id: number): StorageUser | null | Promise<StorageUser | null>;
  createSession(tokenHash: string, userId: number, expiresAt: Date): void | Promise<void>;
  getSession(
    tokenHash: string,
  ): { userId: number; expiresAt: Date } | null | Promise<{ userId: number; expiresAt: Date } | null>;
  deleteSession(tokenHash: string): void | Promise<void>;

  // leads
  listLeads(): Lead[] | Promise<Lead[]>;
  updateLeadStatus(id: string, status: LeadStatus, followUpOn?: string | null): void | Promise<void>;
  setFollowUp(id: string, followUpOn: string | null): void | Promise<void>;
  insertLeads(leads: NewLeadInput[]): Lead[] | Promise<Lead[]>;
  filterUnprocessed(placeIds: string[]): Promise<Set<string>>;
  markProcessed(placeIds: string[]): Promise<void>;

  // call log
  addCall(
    leadId: string,
    outcome: CallOutcome,
    note: string,
    at?: Date,
  ): CallEntry | Promise<CallEntry>;
  listCalls(leadId: string): CallEntry[] | Promise<CallEntry[]>;
  listAllCalls(): CallEntry[] | Promise<CallEntry[]>;

  // settings (places key, future app settings)
  getSetting(key: string): string | null | Promise<string | null>;
  setSetting(key: string, value: string): void | Promise<void>;

  // city x keyword pair exhaustion tracking
  upsertSearchPair(
    city: string,
    keyword: string,
    newLeads: number,
    exhausted: boolean,
  ): void | Promise<void>;
  listSearchPairs(): SearchPairState[] | Promise<SearchPairState[]>;

  // stats bar
  stats(): Stats | Promise<Stats>;
}
