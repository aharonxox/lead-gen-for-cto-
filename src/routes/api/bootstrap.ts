import { createFileRoute } from "@tanstack/react-router";
import { maskKey } from "~/lib/api";
import { getSessionUserId } from "~/lib/auth";
import { TARGET_CITIES, TARGET_KEYWORDS } from "~/lib/seed";
import { getStorage } from "~/lib/storage";

// One bootstrap payload so the dashboard opens with a single round-trip.
export const Route = createFileRoute("/api/bootstrap")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const userId = await getSessionUserId(request);
        if (userId == null) {
          return Response.json({ authenticated: false }, { status: 401 });
        }
        const storage = await getStorage();
        const [leads, pairs, stats, key] = await Promise.all([
          storage.listLeads(),
          storage.listSearchPairs(),
          storage.stats(),
          storage.getSetting("places_api_key"),
        ]);
        return Response.json({
          authenticated: true,
          leads,
          pairs,
          stats,
          cities: TARGET_CITIES,
          keywords: TARGET_KEYWORDS,
          placesKeySet: key != null && key.length > 0,
          placesKeyMasked: key ? maskKey(key) : null,
        });
      },
    },
  },
});
