import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "~/lib/api";
import { CALL_OUTCOMES, type CallOutcome } from "~/lib/types";
import { getStorage } from "~/lib/storage";

// Multi-touch call log. POST appends a timestamped entry (outcome + note);
// GET returns the full history for the lead.
export const Route = createFileRoute("/api/leads/$id/calls")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        const denied = await requireAuth(request);
        if (denied) return denied;
        const storage = await getStorage();
        const calls = await storage.listCalls(params.id);
        return Response.json({ calls });
      },
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
          outcome?: string;
          note?: string;
        };
        const outcome = body.outcome as CallOutcome;
        if (!CALL_OUTCOMES.includes(outcome)) {
          return Response.json(
            { error: "Outcome must be one of: connected, voicemail, callback_booked, no_answer." },
            { status: 400 },
          );
        }
        const storage = await getStorage();
        const entry = await storage.addCall(
          params.id,
          outcome,
          (body.note ?? "").trim(),
        );
        const stats = await storage.stats();
        return Response.json({ ok: true, call: entry, stats });
      },
    },
  },
});
