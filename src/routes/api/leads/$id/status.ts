import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "~/lib/api";
import { LEAD_STATUSES, type LeadStatus } from "~/lib/types";
import { getStorage } from "~/lib/storage";

// Set lead status (green = Client, yellow = Follow Up, red = Trash).
export const Route = createFileRoute("/api/leads/$id/status")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        const denied = await requireAuth(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as {
          status?: string;
          followUpOn?: string | null;
        };
        const status = body.status as LeadStatus;
        if (!LEAD_STATUSES.includes(status)) {
          return Response.json({ error: "Invalid status." }, { status: 400 });
        }
        // Optional "call back on" date set together with the status (e.g.
        // marking a lead Follow Up with a date in one save). Undefined leaves
        // the existing date untouched; null/"" clears it.
        let followUpOn: string | null | undefined;
        if (body.followUpOn === undefined) followUpOn = undefined;
        else if (body.followUpOn === null || body.followUpOn === "") followUpOn = null;
        else {
          followUpOn = String(body.followUpOn);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(followUpOn)) {
            return Response.json(
              { error: "followUpOn must be a YYYY-MM-DD date or null." },
              { status: 400 },
            );
          }
        }
        const storage = await getStorage();
        await storage.updateLeadStatus(params.id, status, followUpOn);
        const stats = await storage.stats();
        return Response.json({ ok: true, status, stats });
      },
    },
  },
});
