import { useEffect, useMemo, useRef, useState } from "react";
import { BRAND, BRAND_TAGLINE } from "~/lib/brand";
import { SCRIPT_SECTIONS } from "~/lib/scripts";
import {
  CALL_OUTCOMES,
  OUTCOME_LABELS,
  STATUS_LABELS,
  type CallEntry,
  type CallOutcome,
  type Lead,
  type LeadStatus,
  type SearchPairState,
  type Stats,
} from "~/lib/types";

interface Bootstrap {
  leads: Lead[];
  pairs: SearchPairState[];
  stats: Stats;
  cities: string[];
  keywords: string[];
  placesKeySet: boolean;
  placesKeyMasked: string | null;
}

type Filter = "all" | LeadStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All Pipeline" },
  { key: "new", label: "New Leads" },
  { key: "yellow", label: "Follow Ups (Yellow)" },
  { key: "green", label: "Clients (Green)" },
  { key: "red", label: "Trash (Red)" },
];

const ROW_BG: Partial<Record<LeadStatus, string>> = {
  green: "bg-[#d1fae5]",
  yellow: "bg-[#fef3c7]",
  red: "bg-[#fee2e2]",
};

const OUTCOME_BADGE: Record<CallOutcome, string> = {
  connected: "bg-[#d1fae5] text-[#065f46]",
  voicemail: "bg-[#fef3c7] text-[#92400e]",
  callback_booked: "bg-[#eff6ff] text-[#1e40af]",
  no_answer: "bg-[#fee2e2] text-[#991b1b]",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [pairMap, setPairMap] = useState<Record<string, SearchPairState>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [selCities, setSelCities] = useState<Set<string>>(new Set());
  const [selKeywords, setSelKeywords] = useState<Set<string>>(new Set());

  const [filter, setFilter] = useState<Filter>("all");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [showScripts, setShowScripts] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [calls, setCalls] = useState<Record<string, CallEntry[]>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [noteOutcome, setNoteOutcome] = useState<Record<string, CallOutcome>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  const noteInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/bootstrap");
        if (res.status === 401) {
          onLogout();
          return;
        }
        const payload = (await res.json()) as Bootstrap;
        setData(payload);
        setLeads(payload.leads);
        setStats(payload.stats);
        const pm: Record<string, SearchPairState> = {};
        for (const p of payload.pairs) pm[`${p.city}|${p.keyword}`] = p;
        setPairMap(pm);
        setSelCities(new Set(payload.cities));
        setSelKeywords(new Set(payload.keywords));
      } catch {
        setLoadError("Could not load the dashboard — refresh to retry.");
      }
    })();
  }, [onLogout]);

  // Auto-clear the flash line so the stats bar area stays quiet while calling.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  const filtered = useMemo(() => {
    if (!leads) return [];
    return filter === "all" ? leads : leads.filter((l) => l.status === filter);
  }, [leads, filter]);

  const exhaustedList = useMemo(() => {
    return Object.values(pairMap)
      .filter((p) => p.exhausted)
      .map((p) => `${p.city} × ${p.keyword}`);
  }, [pairMap]);

  const availablePairs = useMemo(() => {
    let n = 0;
    for (const c of selCities)
      for (const k of selKeywords)
        if (!pairMap[`${c}|${k}`]?.exhausted) n++;
    return n;
  }, [selCities, selKeywords, pairMap]);

  const exhaustedFor = (city: string): number =>
    [...selKeywords].filter((k) => pairMap[`${city}|${k}`]?.exhausted).length;
  const exhaustedForKeyword = (keyword: string): number =>
    [...selCities].filter((c) => pairMap[`${c}|${keyword}`]?.exhausted).length;

  const toggleSet = (
    set: Set<string>,
    value: string,
    apply: (next: Set<string>) => void,
  ) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  async function doFetch() {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/places/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cities: [...selCities],
          keywords: [...selKeywords],
        }),
      });
      const payload = (await res.json()) as {
        leads?: Lead[];
        pairs?: Array<{ city: string; keyword: string; added: number; exhausted: boolean }>;
        message?: string | null;
        stats?: Stats;
        allExhausted?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(payload.error ?? "Fetch failed.");
        return;
      }
      const added = payload.leads?.length ?? 0;
      if (added > 0) setLeads((prev) => [...(payload.leads ?? []), ...prev]);
      if (payload.stats) setStats(payload.stats);
      if (payload.pairs?.length) {
        setPairMap((prev) => {
          const next = { ...prev };
          for (const p of payload.pairs ?? []) {
            const key = `${p.city}|${p.keyword}`;
            const before = next[key];
            next[key] = {
              city: p.city,
              keyword: p.keyword,
              lastSearchedAt: before?.lastSearchedAt ?? null,
              newLeadsFound: (before?.newLeadsFound ?? 0) + p.added,
              exhausted: p.exhausted,
            };
          }
          return next;
        });
      }
      if (payload.message) setFlash(payload.message);
      else if (added > 0) setFlash(`Added ${added} new lead${added === 1 ? "" : "s"} to the top of the pipeline.`);
    } catch {
      setError("Network error while fetching leads — try again.");
    } finally {
      setFetching(false);
    }
  }

  async function setStatus(lead: Lead, status: LeadStatus) {
    const prevStatus = lead.status;
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status } : l)),
    );
    try {
      const res = await fetch(`/api/leads/${lead.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await res.json()) as { stats?: Stats; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "failed");
      if (payload.stats) setStats(payload.stats);
    } catch {
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: prevStatus } : l)),
      );
      setError("Could not save the status — check your connection.");
    }
  }

  async function logCall(leadId: string, outcome: CallOutcome, note: string) {
    setSavingNote(leadId);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, note }),
      });
      const payload = (await res.json()) as {
        call?: CallEntry;
        stats?: Stats;
        error?: string;
      };
      if (!res.ok || !payload.call) {
        setError(payload.error ?? "Could not log the call.");
        return;
      }
      const call = payload.call;
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                callCount: l.callCount + 1,
                lastCallAt: call.at,
                lastNote: call.note || l.lastNote,
              }
            : l,
        ),
      );
      if (payload.stats) setStats(payload.stats);
      setCalls((prev) => ({ ...prev, [leadId]: [call, ...(prev[leadId] ?? [])] }));
      setNoteDraft((prev) => ({ ...prev, [leadId]: "" }));
      noteInputRefs.current[leadId]?.focus();
    } catch {
      setError("Network error while logging the call.");
    } finally {
      setSavingNote(null);
    }
  }

  async function toggleExpand(leadId: string) {
    if (expandedId === leadId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(leadId);
    if (!calls[leadId]) {
      try {
        const res = await fetch(`/api/leads/${leadId}/calls`);
        const payload = (await res.json()) as { calls?: CallEntry[] };
        setCalls((prev) => ({ ...prev, [leadId]: payload.calls ?? [] }));
      } catch {
        setCalls((prev) => ({ ...prev, [leadId]: [] }));
      }
    }
  }

  async function saveSettingsKey(placesKey: string): Promise<string | null> {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placesKey }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        placesKeySet?: boolean;
        placesKeyMasked?: string | null;
        error?: string;
      };
      if (!res.ok || !payload.ok) return payload.error ?? "Save failed.";
      setData((prev) =>
        prev
          ? {
              ...prev,
              placesKeySet: payload.placesKeySet ?? true,
              placesKeyMasked: payload.placesKeyMasked ?? null,
            }
          : prev,
      );
      return null;
    } catch {
      return "Network error while saving.";
    }
  }

  async function doLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // cookie is HttpOnly; worst case it expires server-side later
    }
    onLogout();
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center text-red-600">
        {loadError}
      </div>
    );
  }
  if (!data || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading dashboard…
      </div>
    );
  }

  const statusCell = (lead: Lead) => (
    <div className="flex flex-wrap gap-[5px]">
      <button
        onClick={() => setStatus(lead, "green")}
        className={`min-w-[65px] flex-1 rounded px-2.5 py-2 text-xs font-bold text-white ${
          lead.status === "green" ? "bg-[#059669] ring-2 ring-[#065f46]" : "bg-[#10b981]"
        }`}
      >
        Client
      </button>
      <button
        onClick={() => setStatus(lead, "yellow")}
        className={`min-w-[65px] flex-1 rounded px-2.5 py-2 text-xs font-bold ${
          lead.status === "yellow"
            ? "bg-[#d97706] text-white ring-2 ring-[#92400e]"
            : "bg-[#f59e0b] text-black"
        }`}
      >
        Follow Up
      </button>
      <button
        onClick={() => setStatus(lead, "red")}
        className={`min-w-[65px] flex-1 rounded px-2.5 py-2 text-xs font-bold text-white ${
          lead.status === "red" ? "bg-[#dc2626] ring-2 ring-[#991b1b]" : "bg-[#ef4444]"
        }`}
      >
        Trash
      </button>
      {lead.status !== "new" && (
        <button
          title="Reset to New"
          onClick={() => setStatus(lead, "new")}
          className="rounded border border-gray-300 px-2 py-2 text-xs text-gray-500 hover:bg-gray-100"
        >
          ↺
        </button>
      )}
    </div>
  );

  const quickNoteCell = (lead: Lead) => (
    <div className="flex items-center gap-1.5">
      <input
        ref={(el) => {
          noteInputRefs.current[lead.id] = el;
        }}
        type="text"
        value={noteDraft[lead.id] ?? ""}
        onChange={(e) =>
          setNoteDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void logCall(
              lead.id,
              noteOutcome[lead.id] ?? "connected",
              (noteDraft[lead.id] ?? "").trim(),
            );
          }
        }}
        placeholder={
          lead.lastNote ? `Last: ${lead.lastNote.slice(0, 42)}` : "Log call notes…"
        }
        className="w-full min-w-[140px] rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
      <select
        value={noteOutcome[lead.id] ?? "connected"}
        onChange={(e) =>
          setNoteOutcome((prev) => ({
            ...prev,
            [lead.id]: e.target.value as CallOutcome,
          }))
        }
        title="Call outcome"
        className="rounded border border-gray-300 px-1 py-1.5 text-xs"
      >
        {CALL_OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {OUTCOME_LABELS[o]}
          </option>
        ))}
      </select>
      <button
        onClick={() =>
          void logCall(
            lead.id,
            noteOutcome[lead.id] ?? "connected",
            (noteDraft[lead.id] ?? "").trim(),
          )
        }
        disabled={savingNote === lead.id}
        className="rounded bg-[#374151] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
      >
        {savingNote === lead.id ? "…" : "Log"}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] p-4">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <h1 className="m-0 text-2xl font-bold">{BRAND}</h1>
          <p className="m-0 mt-1 text-sm text-gray-500">
            {BRAND_TAGLINE} — Total Leads Fetched: {stats.totalFetched} | In
            Pipeline: {stats.activeInPipeline} | Currently Viewing:{" "}
            {filtered.length} | Dials Today: {stats.dialsToday}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-md bg-[#374151] px-4 py-2.5 text-sm font-bold text-white"
          >
            Settings{data.placesKeySet ? "" : " ⚠"}
          </button>
          <button
            onClick={() => setShowScripts((s) => !s)}
            className="rounded-md bg-[#374151] px-4 py-2.5 text-sm font-bold text-white"
          >
            Script & Objections
          </button>
          <button
            onClick={doLogout}
            className="rounded-md bg-gray-200 px-4 py-2.5 text-sm font-bold text-[#374151]"
          >
            Log Out
          </button>
          <button
            onClick={() => void doFetch()}
            disabled={fetching || availablePairs === 0}
            className="rounded-md bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {fetching ? "Searching Google Maps…" : "+ Fetch Next 10 Leads"}
          </button>
        </div>
      </div>

      {/* Key banner */}
      {!data.placesKeySet && (
        <div className="mb-5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] p-4 text-sm">
          <strong>One setup step:</strong> add your Google Places API key in{" "}
          <button
            onClick={() => setSettingsOpen(true)}
            className="font-bold text-[#2563eb] underline"
          >
            Settings
          </button>{" "}
          to start fetching. The key is stored server-side, requests are proxied
          through this app's server, and it is only ever shown masked afterwards.
        </div>
      )}

      {/* Script drawer */}
      {showScripts && (
        <div className="mb-5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] p-5 text-sm">
          <h3 className="m-0 mb-2 font-bold text-[#1e40af]">
            {BRAND} Pitch Cheatsheet
          </h3>
          {SCRIPT_SECTIONS.map((s) => (
            <p key={s.title} className="mb-2">
              <strong>{s.title}:</strong> {s.lines[0]}
            </p>
          ))}
        </div>
      )}

      {/* Error / flash banners */}
      {error && (
        <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fee2e2] p-4 text-sm text-[#991b1b]">
          {error}{" "}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-bold underline"
          >
            dismiss
          </button>
        </div>
      )}
      {flash && (
        <div className="mb-4 rounded-xl border border-[#a7f3d0] bg-[#d1fae5] p-4 text-sm text-[#065f46]">
          {flash}
        </div>
      )}

      {/* City & keyword pickers */}
      <div className="mb-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          Cities (multi-select) — {selCities.size}/{data.cities.length} selected
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {data.cities.map((c) => {
            const ex = exhaustedFor(c);
            const allEx = selKeywords.size > 0 && ex === selKeywords.size;
            return (
              <button
                key={c}
                onClick={() => toggleSet(selCities, c, setSelCities)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                  allEx
                    ? "border-gray-200 bg-gray-100 text-gray-400 line-through"
                    : selCities.has(c)
                      ? "border-[#111827] bg-[#111827] text-white"
                      : "border-gray-200 bg-white text-[#1f2937]"
                }`}
              >
                {c}
                {ex > 0 && (
                  <span
                    className={`ml-1 ${allEx ? "" : "text-[#d97706]"}`}
                    title={`${ex} exhausted pair(s)`}
                  >
                    {ex}/{selKeywords.size}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          Keywords (multi-select) — {selKeywords.size}/{data.keywords.length}{" "}
          selected
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {data.keywords.map((k) => {
            const ex = exhaustedForKeyword(k);
            const allEx = selCities.size > 0 && ex === selCities.size;
            return (
              <button
                key={k}
                onClick={() => toggleSet(selKeywords, k, setSelKeywords)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                  allEx
                    ? "border-gray-200 bg-gray-100 text-gray-400 line-through"
                    : selKeywords.has(k)
                      ? "border-[#111827] bg-[#111827] text-white"
                      : "border-gray-200 bg-white text-[#1f2937]"
                }`}
              >
                {k}
                {ex > 0 && (
                  <span
                    className={`ml-1 ${allEx ? "" : "text-[#d97706]"}`}
                    title={`${ex} exhausted pair(s)`}
                  >
                    {ex}/{selCities.size}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="text-xs text-gray-500">
          Available (non-exhausted) pairs for this selection:{" "}
          <strong>{availablePairs}</strong>
          {exhaustedList.length > 0 && (
            <>
              {" "}
              · Exhausted: {exhaustedList.join(", ")} — a new API key in Settings
              re-checks them.
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2.5">
        {FILTERS.map((f) => {
          const count =
            f.key === "all"
              ? leads.length
              : leads.filter((l) => l.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`min-w-[120px] flex-1 rounded-md border px-4 py-2.5 text-sm font-bold ${
                filter === f.key
                  ? "border-[#111827] bg-[#111827] text-white"
                  : "border-gray-200 bg-white text-[#1f2937]"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr>
              <th className="w-[22%] border-b border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
                Clinic Info
              </th>
              <th className="w-[22%] border-b border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
                Location
              </th>
              <th className="w-[14%] border-b border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
                Action
              </th>
              <th className="w-[24%] border-b border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
                Set Status
              </th>
              <th className="w-[18%] border-b border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
                Call Notes
              </th>
              <th className="border-b border-gray-200 bg-gray-50 p-2 text-sm font-semibold text-gray-600">
                History
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-10 text-center text-gray-400"
                >
                  No leads found in this view. Click "+ Fetch Next 10 Leads" to
                  start.
                </td>
              </tr>
            )}
            {filtered.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                expanded={expandedId === lead.id}
                calls={calls[lead.id] ?? []}
                onExpand={() => void toggleExpand(lead.id)}
                statusCell={statusCell(lead)}
                quickNoteCell={quickNoteCell(lead)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {settingsOpen && (
        <SettingsModal
          masked={data.placesKeyMasked}
          isSet={data.placesKeySet}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettingsKey}
        />
      )}
    </div>
  );
}

function LeadRow({
  lead,
  expanded,
  calls,
  onExpand,
  statusCell,
  quickNoteCell,
}: {
  lead: Lead;
  expanded: boolean;
  calls: CallEntry[];
  onExpand: () => void;
  statusCell: React.ReactNode;
  quickNoteCell: React.ReactNode;
}) {
  return (
    <>
      <tr className={`${ROW_BG[lead.status] ?? ""} border-b border-gray-200`}>
        <td className="p-4 align-top text-sm">
          <strong>{lead.name}</strong>
          {lead.website && (
            <>
              <br />
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-gray-500 hover:underline"
              >
                Visit Website
              </a>
            </>
          )}
        </td>
        <td className="p-4 align-top text-sm text-gray-600">
          {lead.address ?? "—"}
        </td>
        <td className="p-4 align-top">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="text-base font-bold text-[#2563eb] hover:underline"
            >
              {lead.phone}
            </a>
          ) : (
            <span className="text-sm text-gray-400">no phone</span>
          )}
        </td>
        <td className="p-4 align-top">{statusCell}</td>
        <td className="p-4 align-top">{quickNoteCell}</td>
        <td className="p-2 align-top">
          <button
            onClick={onExpand}
            title="Show call history"
            className={`rounded px-2 py-1 text-xs font-bold ${
              expanded ? "bg-[#111827] text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {lead.callCount > 0 ? `${lead.callCount} call${lead.callCount === 1 ? "" : "s"}` : "—"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-gray-200 bg-[#f9fafb]">
          <td colSpan={6} className="p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              Call history — {lead.name} ({STATUS_LABELS[lead.status]})
            </div>
            {calls.length === 0 ? (
              <div className="text-sm text-gray-400">
                No calls logged yet. Type a note in the row above and press
                Enter, or expand the outcome picker to log voicemail / no
                answer.
              </div>
            ) : (
              <ul className="m-0 list-none space-y-1.5 p-0">
                {calls.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-500">{fmtTime(c.at)}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${OUTCOME_BADGE[c.outcome]}`}
                    >
                      {OUTCOME_LABELS[c.outcome]}
                    </span>
                    <span>{c.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function SettingsModal({
  masked,
  isSet,
  onClose,
  onSave,
}: {
  masked: string | null;
  isSet: boolean;
  onClose: () => void;
  onSave: (key: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const problem = await onSave(value.trim());
    setBusy(false);
    if (problem) setErr(problem);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-[380px] rounded-xl bg-white p-[30px] shadow-2xl">
        <h3 className="m-0 mb-1 text-lg font-bold">System Settings</h3>
        <label className="text-xs font-bold text-gray-500">
          Google Places API Key
        </label>
        {isSet && (
          <p className="mb-2 mt-1 rounded bg-[#eff6ff] px-2 py-1.5 text-xs text-[#1e40af]">
            Current key: <strong>{masked}</strong> (stored server-side, never
            shown in full)
          </p>
        )}
        <form onSubmit={submit}>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isSet ? "Paste a new key to replace it" : "AIzaSy…"}
            required
            autoFocus
            className="mb-1 w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm"
          />
          <p className="mb-3 mt-1 text-xs text-gray-500">
            Update your key here if it expired or stopped working. Requires
            "Places API (New)" enabled and billing active on your Google
            project. Requests run through this server — the key never appears in
            the browser.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md bg-gray-200 px-4 py-2.5 text-sm font-bold text-[#374151]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-md bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save Key"}
            </button>
          </div>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </form>
      </div>
    </div>
  );
}
