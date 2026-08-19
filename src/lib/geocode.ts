import type { GeocodeResult } from "./types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const PHOTON_URL = "https://photon.komoot.io/api";

const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY",
};

export function stateAbbreviation(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(key)) return key.toUpperCase();
  return STATE_ABBR[key] ?? null;
}

export function toApiLocation(result: GeocodeResult): string {
  const parts: string[] = [];
  if (result.city && result.city.length > 0) parts.push(result.city);
  const abbr = result.state ? stateAbbreviation(result.state) : null;
  if (abbr) parts.push(abbr);
  if (parts.length > 0) return parts.join(", ");
  if (result.zip && result.zip.length > 0) return result.zip;
  return result.label;
}

const cache = new Map<string, { at: number; results: GeocodeResult[] }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

function throttle(): Promise<void> {
  queue = queue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  return queue;
}

function normalizeResult(raw: Record<string, unknown>): GeocodeResult {
  const address = (raw.address ?? {}) as Record<string, unknown>;
  const parts = [
    raw.display_name,
    address.city,
    address.town,
    address.village,
    address.hamlet,
    address.state,
    address.postcode,
    address.country,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  return {
    lat: Number(raw.lat),
    lng: Number(raw.lon),
    label: parts[0] ?? "Unknown location",
    city: (address.city ?? address.town ?? address.village) as string | undefined,
    state: address.state as string | undefined,
    zip: address.postcode as string | undefined,
    country: address.country as string | undefined,
  };
}

export async function geocode(query: string, limit = 6): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.results;

  await throttle();

  let results: GeocodeResult[] = [];
  let lastError: unknown = null;

  try {
    results = await geocodeNominatim(q, limit);
  } catch (error) {
    lastError = error;
  }
  if (results.length === 0) {
    try {
      results = await geocodePhoton(q, limit);
    } catch (error) {
      lastError = error;
    }
  }

  if (results.length === 0 && lastError !== null) {
    throw new Error(lastError instanceof Error ? lastError.message : "Geocoding failed");
  }

  cache.set(cacheKey, { at: Date.now(), results });
  return results;
}

async function geocodeNominatim(query: string, limit: number): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "us",
    limit: String(limit),
  });

  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": "RentalHub/1.0 (rental property search demo)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>[];
  return data.map(normalizeResult);
}

async function geocodePhoton(query: string, limit: number): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${PHOTON_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Photon geocoding failed: ${res.status}`);
  }

  const data = (await res.json()) as { features?: unknown };
  if (!Array.isArray(data.features)) return [];

  const results: GeocodeResult[] = [];
  for (const raw of data.features) {
    if (!raw || typeof raw !== "object") continue;
    const feature = raw as Record<string, unknown>;
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const geom = (feature.geometry ?? {}) as Record<string, unknown>;
    const coords = geom.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;

    const name = typeof props.name === "string" ? props.name : undefined;
    const osmValue = typeof props.osm_value === "string" ? props.osm_value : "";
    const isSettled = ["city", "town", "village", "hamlet", "locality"].includes(osmValue);
    const city =
      (typeof props.city === "string" && props.city.length > 0) || isSettled
        ? (props.city as string) || name
        : undefined;
    const state = typeof props.state === "string" ? props.state : undefined;
    const country = typeof props.country === "string" ? props.country : undefined;
    const zip = typeof props.postcode === "string" ? props.postcode : undefined;

    const labelParts = [name, city !== name ? city : undefined, state, country].filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );

    results.push({
      lat: Number(coords[1]),
      lng: Number(coords[0]),
      label: labelParts.length > 0 ? labelParts.join(", ") : "Unknown location",
      city,
      state,
      zip,
      country,
    });
  }

  return results;
}