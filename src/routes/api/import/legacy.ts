import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "~/lib/api";
import { LEAD_STATUSES, type LeadStatus } from "~/lib/types";
import { getStorage } from "~/lib/storage";

// Old-leads import (Feasibility verdict, Candidate 3): paste or upload the
// JSON dump produced by the one-line console snippet in the owner's OLD
// browser (the exporter of localStorage keys az_leads / az_processed_ids).
//
// Merge rules:
//  - match by place_id; an existing place_id is LEFT AS-IS (idempotent on
//    re-runs — nothing is duplicated or overwritten)
//  - new leads keep their legacy status (new/green/yellow/red)
//  - a legacy `notes` field becomes the lead's first call_log entry
//  - az_processed_ids are merged into processed_place_ids so the global
//    dedupe matches the old browser's history
interface LegacyLead {
  place_id?: unknown;
  placeId?: unknown;
  name?: unknown;
  address?: unknown;
  phone?: unknown;
  website?: unknown;
  status?: unknown;
  notes?: unknown;
}

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

export const Route = createFileRoute("/api/import/legacy")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const denied = await requireAuth(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as { raw?: string };
        const raw = (body.raw ?? "").trim();
        if (raw.length === 0) {
          return Response.json(
            { error: "Paste the JSON dump first (or upload the .json file)." },
            { status: 400 },
          );
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return Response.json(
            {
              error:
                "That isn't valid JSON. Copy the snippet shown below, run it in the old browser's console on the old CRM page, then paste what it copies here.",
            },
            { status: 400 },
          );
        }

        let legacyLeads: unknown[] = [];
        let processedIds: string[] = [];
        if (Array.isArray(parsed)) {
          legacyLeads = parsed;
        } else if (parsed && typeof parsed === "object") {
          const obj = parsed as Record<string, unknown>;
          const leadsRaw = obj.az_leads ?? obj.leads ?? [];
          const idsRaw = obj.az_processed_ids ?? obj.processedIds ?? [];
          legacyLeads = Array.isArray(leadsRaw) ? leadsRaw : [];
          processedIds = Array.isArray(idsRaw) ? idsRaw.map(String) : [];
        } else {
          return Response.json(
            { error: "Unexpected JSON shape — expected the az_leads dump (an array) or an object with az_leads/az_processed_ids." },
            { status: 400 },
          );
        }

        // Normalize rows first so the summary counts are exact.
        const rows: Array<{
          placeId: string;
          name: string;
          address: string | null;
          phone: string | null;
          website: string | null;
          status: LeadStatus;
          notes: string | null;
        }> = [];
        let skippedRows = 0;
        for (const item of legacyLeads) {
          if (!item || typeof item !== "object") {
            skippedRows++;
            continue;
          }
          const l = item as LegacyLead;
          const placeId = asStr(l.place_id ?? l.placeId);
          if (!placeId) {
            skippedRows++; // without a place_id we can't dedupe — skip, count it
            continue;
          }
          const statusRaw = asStr(l.status) as LeadStatus | null;
          const status: LeadStatus =
            statusRaw && LEAD_STATUSES.includes(statusRaw) ? statusRaw : "new";
          const notes = asStr(l.notes);
          rows.push({
            placeId,
            name: asStr(l.name) ?? "Unnamed clinic",
            address: asStr(l.address),
            phone: asStr(l.phone),
            website: asStr(l.website),
            status,
            notes,
          });
        }

        const storage = await getStorage();
        const existing = new Set((await storage.listLeads()).map((l) => l.placeId));

        let added = 0;
        let merged = 0;
        let notesImported = 0;
        for (const row of rows) {
          if (existing.has(row.placeId)) {
            merged++;
            continue;
          }
          const inserted = await storage.insertLeads([
            {
              placeId: row.placeId,
              name: row.name,
              address: row.address,
              phone: row.phone,
              website: row.website,
            },
          ]);
          const lead = inserted[0];
          if (!lead) {
            merged++; // raced/insert no-op — treat as already present
            continue;
          }
          if (row.status !== "new") {
            await storage.updateLeadStatus(lead.id, row.status);
          }
          if (row.notes) {
            // Legacy single notes field → first entry in the multi-touch log.
            await storage.addCall(lead.id, "connected", row.notes);
            notesImported++;
          }
          existing.add(row.placeId);
          added++;
        }

        if (processedIds.length > 0) {
          await storage.markProcessed(processedIds);
        }

        return Response.json({
          ok: true,
          added,
          merged,
          skippedRows,
          notesImported,
          processedIdsImported: processedIds.length,
        });
      },
    },
  },
});
