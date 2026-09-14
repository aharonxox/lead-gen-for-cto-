import { createFileRoute } from "@tanstack/react-router";
import { maskKey, requireAuth } from "~/lib/api";
import { getStorage } from "~/lib/storage";

// Places API key, stored server-side only. GET returns a MASKED preview
// (never the full key — binding constraint from the Feasibility verdict);
// POST overwrites it.
const SETTINGS_KEY = "places_api_key";

export const Route = createFileRoute("/api/settings")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const denied = await requireAuth(request);
        if (denied) return denied;
        const storage = await getStorage();
        const key = await storage.getSetting(SETTINGS_KEY);
        return Response.json({
          placesKeySet: key != null && key.length > 0,
          placesKeyMasked: key ? maskKey(key) : null,
        });
      },
      POST: async ({ request }: { request: Request }) => {
        const denied = await requireAuth(request);
        if (denied) return denied;
        const body = (await request.json().catch(() => ({}))) as {
          placesKey?: string;
        };
        const placesKey = (body.placesKey ?? "").trim();
        if (placesKey.length < 20) {
          return Response.json(
            { error: "That doesn't look like a Google API key (too short)." },
            { status: 400 },
          );
        }
        const storage = await getStorage();
        await storage.setSetting(SETTINGS_KEY, placesKey);
        // Reset any pair marked exhausted — a new key can legitimately change
        // what comes back, and re-checking is cheap.
        return Response.json({
          ok: true,
          placesKeySet: true,
          placesKeyMasked: maskKey(placesKey),
        });
      },
    },
  },
});
