import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "~/lib/api";
import { PlacesError, placeDetails, textSearch } from "~/lib/places";
import { TARGET_CITIES, TARGET_KEYWORDS, TARGET_STATE } from "~/lib/seed";
import { getStorage } from "~/lib/storage";
import type { NewLeadInput } from "~/lib/types";

// Server-side Google Places flow (Places API (New)). Replaces the old
// client-side Maps JS SDK: the key stays on the server, the caller picks
// city + keyword pairs, dedupe is GLOBAL (a place fetched on any device is
// never re-fetched anywhere), and the batch stays at 10.
const BATCH_SIZE = 10;
const MAX_SEARCHES_PER_FETCH = 12; // bounds latency + API spend per click

interface PairReport {
  city: string;
  keyword: string;
  results: number;
  fresh: number;
  added: number;
  exhausted: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const Route = createFileRoute("/api/places/fetch")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const denied = await requireAuth(request);
        if (denied) return denied;

        const storage = await getStorage();
        const key = await storage.getSetting("places_api_key");
        if (!key) {
          return Response.json(
            { error: "No Google Places API key yet — open Settings and add your key first." },
            { status: 400 },
          );
        }

        const body = (await request.json().catch(() => ({}))) as {
          cities?: string[];
          keywords?: string[];
        };
        // Never trust the client with arbitrary query text — intersect with
        // the seeded lists (identical to the old CRM's lists).
        const cities = (body.cities ?? []).filter((c): c is string =>
          (TARGET_CITIES as readonly string[]).includes(c),
        );
        const keywords = (body.keywords ?? []).filter((k): k is string =>
          (TARGET_KEYWORDS as readonly string[]).includes(k),
        );
        if (cities.length === 0 || keywords.length === 0) {
          return Response.json(
            { error: "Pick at least one city and one keyword first." },
            { status: 400 },
          );
        }

        const knownPairs = await storage.listSearchPairs();
        const exhaustedSet = new Set(
          knownPairs.filter((p) => p.exhausted).map((p) => `${p.city}|${p.keyword}`),
        );
        const candidates = shuffle(
          cities.flatMap((city) =>
            keywords
              .filter((k) => !exhaustedSet.has(`${city}|${k}`))
              .map((keyword) => ({ city, keyword })),
          ),
        );

        if (candidates.length === 0) {
          return Response.json({
            leads: [],
            pairs: [] as PairReport[],
            allExhausted: true,
            message:
              "Every selected city/keyword pair is exhausted — pick different pairs, or widen the selection.",
            stats: await storage.stats(),
          });
        }

        let remaining = BATCH_SIZE;
        const collected: Awaited<ReturnType<typeof storage.listLeads>> = [];
        const report: PairReport[] = [];
        let fatalError: string | null = null;

        for (const pair of candidates) {
          if (remaining <= 0 || report.length >= MAX_SEARCHES_PER_FETCH) break;
          const query = `${pair.keyword} in ${pair.city}, ${TARGET_STATE}`;
          let results;
          try {
            results = await textSearch(key, query);
          } catch (e) {
            if (e instanceof PlacesError) {
              fatalError = e.message;
              break;
            }
            fatalError =
              "Could not reach Google Places — check your connection and try again.";
            break;
          }

          const ids = results.map((r) => r.id).filter(Boolean);
          const processed = await storage.filterUnprocessed(ids);
          const fresh = results.filter((r) => r.id && !processed.has(r.id));
          const take = fresh.slice(0, remaining);

          // Fill missing phone/website via Place Details (New), best effort,
          // in parallel — mirrors the old app's per-lead getDetails pass.
          await Promise.allSettled(
            take.map(async (place) => {
              if (place.nationalPhoneNumber && place.websiteUri) return;
              const detail = await placeDetails(key, place.id);
              if (!detail) return;
              place.nationalPhoneNumber =
                place.nationalPhoneNumber ?? detail.nationalPhoneNumber;
              place.websiteUri = place.websiteUri ?? detail.websiteUri;
              place.formattedAddress =
                place.formattedAddress ?? detail.formattedAddress;
            }),
          );

          // Old-app behavior preserved: only businesses WITH a public phone
          // become rows in the pipeline; everything fetched is marked
          // processed so it never comes back.
          const withPhone = take.filter((p) => p.nationalPhoneNumber);
          const inputs: NewLeadInput[] = withPhone.map((p) => ({
            placeId: p.id,
            name: p.displayName?.text?.trim() || "Unnamed business",
            address: p.formattedAddress ?? `${pair.city}, ${TARGET_STATE}`,
            phone: p.nationalPhoneNumber ?? null,
            website: p.websiteUri ?? null,
          }));
          const inserted = await storage.insertLeads(inputs);
          collected.push(...inserted);

          // Mark any fetched-but-not-inserted (phone-less) places processed.
          const notInserted = take
            .filter((p) => !inserted.some((l) => l.placeId === p.id))
            .map((p) => p.id);
          await storage.markProcessed(notInserted);

          const exhausted = fresh.length === 0 || take.length === fresh.length;
          await storage.upsertSearchPair(pair.city, pair.keyword, inserted.length, exhausted);
          report.push({
            city: pair.city,
            keyword: pair.keyword,
            results: results.length,
            fresh: fresh.length,
            added: inserted.length,
            exhausted,
          });
          remaining -= inserted.length;
        }

        if (fatalError && collected.length === 0) {
          return Response.json(
            { error: fatalError, pairs: report },
            { status: 502 },
          );
        }

        const message =
          collected.length === 0
            ? fatalError ??
              "No new unique clinics found in the selected pairs — try more pairs."
            : null;

        return Response.json({
          leads: collected,
          pairs: report,
          message,
          stats: await storage.stats(),
        });
      },
    },
  },
});
