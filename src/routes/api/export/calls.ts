import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "~/lib/api";
import { toCsv } from "~/lib/csv";
import { OUTCOME_LABELS } from "~/lib/types";
import { getStorage } from "~/lib/storage";

// One-click full call-history export: one row per logged call with the lead's
// name alongside (stable columns for pivoting). Behind login like everything.
export const Route = createFileRoute("/api/export/calls")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const denied = await requireAuth(request);
        if (denied) return denied;
        const storage = await getStorage();
        const [calls, leads] = await Promise.all([
          storage.listAllCalls(),
          storage.listLeads(),
        ]);
        const nameById = new Map(leads.map((l) => [l.id, l.name]));
        const csv = toCsv(
          ["Call ID", "Lead ID", "Lead Name", "Called At", "Outcome", "Outcome Label", "Note"],
          calls.map((c) => [
            c.id,
            c.leadId,
            nameById.get(c.leadId) ?? "",
            c.at,
            c.outcome,
            OUTCOME_LABELS[c.outcome],
            c.note,
          ]),
        );
        const today = new Date().toISOString().slice(0, 10);
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="peptidebridge-call-history-${today}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
