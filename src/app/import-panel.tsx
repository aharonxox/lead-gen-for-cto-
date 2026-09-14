import { useRef, useState } from "react";

// Old-leads importer (settings page). The owner runs the console snippet in
// his OLD browser (where the original az_leads localStorage lives), pastes the
// dump here (or uploads the .json), and the server merges by place_id —
// idempotent on re-runs (Feasibility verdict, Candidate 3).
const SNIPPET =
  'copy(JSON.stringify({az_leads: JSON.parse(localStorage.getItem("az_leads")||"[]"), az_processed_ids: JSON.parse(localStorage.getItem("az_processed_ids")||"[]")}));console.log("Copied! Paste it into the importer.");';

export interface ImportSummary {
  added: number;
  merged: number;
  skippedRows: number;
  notesImported: number;
  processedIdsImported: number;
}

export default function ImportPanel({
  onImported,
}: {
  onImported: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      // Clipboard can be blocked — the snippet is selectable text anyway.
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result ?? ""));
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch("/api/import/legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        added?: number;
        merged?: number;
        skippedRows?: number;
        notesImported?: number;
        processedIdsImported?: number;
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Import failed.");
        return;
      }
      setSummary({
        added: payload.added ?? 0,
        merged: payload.merged ?? 0,
        skippedRows: payload.skippedRows ?? 0,
        notesImported: payload.notesImported ?? 0,
        processedIdsImported: payload.processedIdsImported ?? 0,
      });
      setRaw("");
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    } catch {
      setError("Network error during import.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 border-t border-gray-200 pt-4">
      <h4 className="m-0 mb-1 text-sm font-bold text-[#1f2937]">
        Import your old leads (one-time)
      </h4>
      <p className="m-0 mb-2 text-xs text-gray-500">
        Brings the pipeline from your old browser's localStorage into this app:
        leads keep their status and notes (notes become the first entry in the
        call history). Merging is by place_id and safe to re-run — existing
        leads are never duplicated or overwritten.
      </p>
      <ol className="m-0 mb-2 list-decimal space-y-1.5 pl-5 text-xs text-gray-600">
        <li>
          Open the <strong>old CRM file</strong> in the browser where you used
          to work, and press F12 (DevTools console).
        </li>
        <li>
          Paste this snippet and hit Enter — it copies your data to the
          clipboard:{" "}
          <button
            type="button"
            onClick={() => void copySnippet()}
            className="ml-1 rounded bg-[#2563eb] px-2 py-0.5 text-xs font-bold text-white"
          >
            {copied ? "Copied!" : "Copy snippet"}
          </button>
          <pre className="mt-1 overflow-x-auto rounded bg-[#111827] p-2 text-[11px] leading-snug text-[#d1fae5]">
            {SNIPPET}
          </pre>
        </li>
        <li>Paste the dump below (or upload the .json file) and click Import.</li>
      </ol>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={4}
        placeholder='Paste the dump here — looks like {"az_leads":[…],"az_processed_ids":[…]} (a bare lead array works too)'
        className="w-full rounded-md border border-gray-300 p-2 font-mono text-xs"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || raw.trim().length === 0}
          className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "Importing…" : "Import Leads"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-xs text-gray-500"
        />
      </div>
      {summary && (
        <div className="mt-2 rounded-md border border-[#a7f3d0] bg-[#d1fae5] p-2 text-xs text-[#065f46]">
          <strong>Done.</strong> Added {summary.added} new lead
          {summary.added === 1 ? "" : "s"} · {summary.merged} already in the
          pipeline (skipped) · {summary.notesImported} legacy note
          {summary.notesImported === 1 ? "" : "s"} added to call history ·{" "}
          {summary.processedIdsImported} processed ID
          {summary.processedIdsImported === 1 ? "" : "s"} merged. The dashboard
          behind this dialog is already refreshed.
        </div>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
