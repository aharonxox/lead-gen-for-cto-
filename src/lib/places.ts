// Google Places API (New) wrapper — SERVER-SIDE ONLY. The old app loaded the
// client-side Maps JS SDK with the key in the script URL (analysis risk #3);
// here the key stays on the server and never reaches the browser.
//
// Uses Text Search (New) for discovery + Place Details (New) to fill any
// missing phone/website, exactly the data the old flow collected.
//
// Error guidance preserved from the old app: failures point the caller at
// "Places API (New) enabled + billing" on their Google project.

const BASE = "https://places.googleapis.com/v1";

const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
].join(",");

const DETAILS_FIELDS = "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri";

export interface PlaceResult {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

export class PlacesError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function toPlacesError(res: Response): Promise<PlacesError> {
  let msg = "";
  let reason = "";
  try {
    const body = (await res.json()) as {
      error?: { message?: string; status?: string; details?: Array<{ reason?: string }> };
    };
    msg = body?.error?.message ?? "";
    reason = body?.error?.details?.[0]?.reason ?? body?.error?.status ?? "";
  } catch {
    // fall through to generic guidance
  }
  if (
    res.status === 403 ||
    /PERMISSION_DENIED/i.test(reason) ||
    /has not been used|is disabled|not authorized/i.test(msg)
  ) {
    return new PlacesError(
      `Google Places rejected the request (403). Verify that "Places API (New)" is enabled for this key and that billing is active on your Google project. ${msg}`.trim(),
      res.status,
    );
  }
  if (res.status === 400 && /API key not valid/i.test(msg)) {
    return new PlacesError(
      "Google says this API key is not valid — open Settings and re-enter it.",
      res.status,
    );
  }
  if (res.status === 429) {
    return new PlacesError(
      `Google Places rate limit hit — wait a moment and fetch again. ${msg}`.trim(),
      res.status,
    );
  }
  return new PlacesError(
    `Places API error ${res.status}: ${msg || res.statusText}`,
    res.status,
  );
}

export async function textSearch(
  key: string,
  textQuery: string,
): Promise<PlaceResult[]> {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify({ textQuery, pageSize: 20 }),
  });
  if (!res.ok) throw await toPlacesError(res);
  const data = (await res.json()) as { places?: PlaceResult[] };
  return data.places ?? [];
}

// Best-effort: fill phone/website the search response lacked. Returns null on
// any failure — the search data is still good enough to show the lead.
export async function placeDetails(
  key: string,
  placeId: string,
): Promise<PlaceResult | null> {
  try {
    const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": DETAILS_FIELDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as PlaceResult;
  } catch {
    return null;
  }
}
