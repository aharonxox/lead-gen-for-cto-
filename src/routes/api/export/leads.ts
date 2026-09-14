import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "~/lib/api";
import { toCsv } from "~/lib/csv";
import { STATUS_LABELS } from "~/lib/types";
import { getStorage } from "~/lib/storage";

// One-click backup/pivot export: every lead with status, follow-up date and
// its latest note. Column order is STABLE (the owner pivots on it in
// Excel/Sheets) — additions go at the end, never reordered or renamed.
export const Route = createFileRoute("/api/export/leads")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const denied = await requireAuth(request);
        if (denied) return denied;
        const storage = await getStorage();
        const leads = await storage.listLeads();
        const csv = toCsv(
          [
            "Lead ID",
            "Place ID",
            "Name",
            "Address",
            "Phone",
            "Website",
            "Status",
            "Status Label",
            "Follow Up On",
            "Created At",
            "Call Count",
            "Last Call At",
            "Last Note",
          ],
          leads.map((l) => [
            l.id,
            l.placeId,
            l.name,
            l.address ?? "",
            l.phone ?? "",
            l.website ?? "",
            l.status,
            STATUS_LABELS[l.status],
            l.followUpOn ?? "",
            l.createdAt,
            l.callCount,
            l.lastCallAt ?? "",
            l.lastNote ?? "",
          ]),
        );
        const today = new Date().toISOString().slice(0, 10);
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="peptidebridge-leads-${today}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
