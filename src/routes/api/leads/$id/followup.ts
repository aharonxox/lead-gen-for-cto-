import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "~/lib/api";
import { getStorage } from "~/lib/storage";

// "Call back on" date for a lead (Phase 2 follow-up queue). POST sets or
// clears it; the dashboard's Today's Follow-ups panel and the status cell
// both use this endpoint.
export const Route = createFileRoute("/api/leads/$id/followup")({
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
          followUpOn?: string | null;
        };
        let followUpOn: string | null = null;
        if (body.followUpOn != null && body.followUpOn !== "") {
          followUpOn = String(body.followUpOn);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(followUpOn)) {
            return Response.json(
              { error: "followUpOn must be a YYYY-MM-DD date or null." },
              { status: 400 },
            );
          }
        }
        const storage = await getStorage();
        await storage.setFollowUp(params.id, followUpOn);
        return Response.json({ ok: true, followUpOn });
      },
    },
  },
});
