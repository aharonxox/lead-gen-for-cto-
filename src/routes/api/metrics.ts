import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "~/lib/api";
import { computeMetrics } from "~/lib/metrics";
import { getStorage } from "~/lib/storage";

// Pipeline metrics, computed server-side from call_log + leads (no external
// analytics). ?tz=<minutes> = the caller's getTimezoneOffset() so "today"
// rolls over on the caller's midnight, not the server's.
export const Route = createFileRoute("/api/metrics")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const denied = await requireAuth(request);
        if (denied) return denied;
        const url = new URL(request.url);
        const tzRaw = Number(url.searchParams.get("tz"));
        const tz = Number.isFinite(tzRaw) ? Math.max(-840, Math.min(840, tzRaw)) : 0;
        const storage = await getStorage();
        const [leads, calls] = await Promise.all([
          storage.listLeads(),
          storage.listAllCalls(),
        ]);
        return Response.json({ metrics: computeMetrics(leads, calls, tz) });
      },
    },
  },
});
