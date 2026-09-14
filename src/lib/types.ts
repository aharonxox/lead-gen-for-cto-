// Domain types shared by storage backends, API routes, and the dashboard UI.

export type LeadStatus = "new" | "green" | "yellow" | "red";
export const LEAD_STATUSES: LeadStatus[] = ["new", "green", "yellow", "red"];

// Color language (sacred): green = Client, yellow = Follow Up, red = Trash.
export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  green: "Client",
  yellow: "Follow Up",
  red: "Trash",
};

export type CallOutcome =
  | "connected"
  | "voicemail"
  | "callback_booked"
  | "no_answer";
export const CALL_OUTCOMES: CallOutcome[] = [
  "connected",
  "voicemail",
  "callback_booked",
  "no_answer",
];

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  connected: "Connected",
  voicemail: "Voicemail",
  callback_booked: "Callback Booked",
  no_answer: "No Answer",
};

export interface Lead {
  id: string;
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  status: LeadStatus;
  followUpOn: string | null; // "call back on" date, YYYY-MM-DD (caller's local calendar)
  createdAt: string; // ISO string (safe for React rendering)
  callCount: number;
  lastCallAt: string | null;
  lastNote: string | null;
}

export interface CallEntry {
  id: number;
  leadId: string;
  at: string; // ISO string
  outcome: CallOutcome;
  note: string;
}

export interface SearchPairState {
  city: string;
  keyword: string;
  lastSearchedAt: string | null;
  newLeadsFound: number; // lifetime new leads this pair produced
  exhausted: boolean; // no unprocessed place_ids left on its first results page
}

export interface Stats {
  totalFetched: number; // = processed place_ids count (matches old stats bar)
  activeInPipeline: number; // leads not trashed
  counts: Record<LeadStatus, number>;
  dialsToday: number; // call_log entries since local midnight (server time)
}

// Caller's scoreboard — computed server-side from call_log + leads only
// (Feasibility verdict item 7: no external analytics service).
export interface PipelineMetrics {
  dialsToday: number;
  dialsWeek: number; // since Monday 00:00 (caller's tz via ?tz= offset)
  connectsToday: number;
  connectsWeek: number;
  connectRateToday: number | null; // connected ÷ dials; null when no dials
  connectRateWeek: number | null;
  counts: Record<LeadStatus, number>;
  worked: number; // leads with status != new OR at least one logged call
  conversion: number | null; // green ÷ worked; null when nothing worked yet
  followUpsDue: number; // yellow leads with call-back date <= today
  followUpsOverdue: number; // date < today
}

export interface NewLeadInput {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
}
