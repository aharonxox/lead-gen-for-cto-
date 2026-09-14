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
        };
        const status = body.status as LeadStatus;
        if (!LEAD_STATUSES.includes(status)) {
          return Response.json({ error: "Invalid status." }, { status: 400 });
        }
        const storage = await getStorage();
        await storage.updateLeadStatus(params.id, status);
        const stats = await storage.stats();
        return Response.json({ ok: true, status, stats });
      },
    },
  },
});
