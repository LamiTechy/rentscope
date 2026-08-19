import type { Filters, Listing } from "./types";

const APARTMENTS_BASE = "https://apartments.realtyapi.io";

export const MOCK_DATA_NOTE =
  "You are viewing sample data. Add a REALTYAPI_KEY to .env.local to load real rental listings.";

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function appliesToFilters(listing: Listing, filters: Filters): boolean {
  if (filters.maxPrice !== null && listing.price > filters.maxPrice) return false;
  if (filters.minBeds !== null && (listing.bedrooms ?? 0) < filters.minBeds) return false;
  if (
    filters.propertyType !== null &&
    listing.propertyType.toLowerCase() !== filters.propertyType.toLowerCase()
  )
    return false;
  return true;
}

export async function fetchRealtyApiListings(
  label: string,
  lat: number,
  lng: number,
  filters: Filters,
): Promise<Listing[]> {
  const apiKey = process.env.REALTYAPI_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    location: label,
    resultCount: "50",
    sortOrder: "Lowest_Rent",
  });
  if (filters.maxPrice !== null) params.set("priceRange", `max:${filters.maxPrice}`);
  if (filters.minBeds !== null) params.set("bedRange", `min:${filters.minBeds}`);
  if (filters.propertyType) {
    const valid = ["Apartment", "House", "Condo", "Townhouse", "Room"];
    const mapped = valid.find(
      (v) => v.toLowerCase() === filters.propertyType!.toLowerCase(),
    );
    if (mapped) params.set("propertyType", mapped);
  }

  const res = await fetch(`${APARTMENTS_BASE}/search/bylocation?${params.toString()}`, {
    headers: { "x-realtyapi-key": apiKey },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`Apartments API error: ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const rawListings = findResultsArray(data);

  const radiusM = filters.radiusMiles * 1609.34;
  return rawListings
    .map(normalizeApartmentsListing)
    .filter((l): l is Listing => l !== null)
    .filter((l) => appliesToFilters(l, filters))
    .filter((l) => haversineMiles(lat, lng, l.lat, l.lng) * 1609.34 <= radiusM)
    .sort(
      (a, b) =>
        haversineMiles(lat, lng, a.lat, a.lng) - haversineMiles(lat, lng, b.lat, b.lng),
    )
    .slice(0, 50);
}

function findResultsArray(data: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of ["searchResults", "results", "data", "listings", "placards", "items"]) {
    const value = data[key];
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      return value as Record<string, unknown>[];
    }
  }
  return [];
}

function toProxyImageUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (host.endsWith(".apartments.com")) {
      return `/api/img?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // fall through — leave the URL untouched
  }
  return url;
}

export async function fetchApartmentsPhotos(listingKey: string): Promise<string[]> {
  const apiKey = process.env.REALTYAPI_KEY;
  if (!apiKey || !listingKey) return [];

  const res = await fetch(
    `${APARTMENTS_BASE}/details/photos?listingKey=${encodeURIComponent(listingKey)}`,
    {
      headers: { "x-realtyapi-key": apiKey },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as { photos?: unknown };
  if (!Array.isArray(data.photos)) return [];

  const items = data.photos.filter(
    (p): p is Record<string, unknown> => !!p && typeof p === "object",
  );
  return items
    .map((p) => {
      const u = p.url;
      return {
        u: typeof u === "string" && u.length > 0 ? u : null,
        w: typeof p.width === "number" ? p.width : 0,
      };
    })
    .filter((x): x is { u: string; w: number } => x.u !== null)
    .sort((a, b) => b.w - a.w)
    .slice(0, 12)
    .map((x) => toProxyImageUrl(x.u));
}

export interface ListingDetails {
  photos: string[];
  baths: number | null;
  sqft: number | null;
}

export async function fetchListingDetails(listingKey: string): Promise<ListingDetails> {
  const apiKey = process.env.REALTYAPI_KEY;
  if (!apiKey || !listingKey) return { photos: [], baths: null, sqft: null };

  const photosPromise = fetchApartmentsPhotos(listingKey).catch(() => []);

  const availPromise = fetch(
    `${APARTMENTS_BASE}/details/availabilities?listingKey=${encodeURIComponent(listingKey)}`,
    {
      headers: { "x-realtyapi-key": apiKey },
      signal: AbortSignal.timeout(15000),
    },
  )
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as { availabilities?: unknown };
      return data.availabilities;
    })
    .catch(() => null);

  const [photos, availabilities] = await Promise.all([photosPromise, availPromise]);

  let baths: number | null = null;
  let sqft: number | null = null;
  if (Array.isArray(availabilities)) {
    for (const group of availabilities) {
      const details = group && typeof group === "object" ? (group as Record<string, unknown>).details : null;
      if (!Array.isArray(details) || details.length === 0) continue;
      const first = details[0] as Record<string, unknown>;
      if (baths === null) {
        const bathNum = first.bathNum ?? first.baths;
        if (typeof bathNum === "number") baths = bathNum;
        else if (typeof first.baths === "string") {
          const n = Number.parseFloat(first.baths);
          if (Number.isFinite(n)) baths = n;
        }
      }
      if (sqft === null) {
        const area = first.area ?? first.sqft;
        if (typeof area === "number") sqft = area;
        else if (typeof area === "string") {
          const n = Number.parseFloat(area.replace(/[^\d.]/g, ""));
          if (Number.isFinite(n)) sqft = n;
        }
      }
      if (baths !== null && sqft !== null) break;
    }
  }

  return { photos, baths, sqft };
}

function parseRangeRange(raw: unknown): { min: number | null; max: number | null } {
  const result = { min: null as number | null, max: null as number | null };
  if (typeof raw !== "string") return result;
  const numbers = raw
    .match(/\$?\s*([\d,]+(?:\.\d+)?)/g)
    ?.map((n) => Number.parseFloat(n.replace(/[^\d.]/g, "")));
  if (!numbers || numbers.length === 0) return result;
  result.min = numbers[0];
  if (numbers.length > 1) result.max = numbers[numbers.length - 1];
  return result;
}

function parseBedRange(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const numbers = raw
    .match(/\d+/g)
    ?.map(Number);
  if (!numbers || numbers.length === 0) return null;
  return Math.max(...numbers);
}

function pickAddress(placard: Record<string, unknown>): string {
  if (typeof placard.oneLineAddress === "string" && placard.oneLineAddress.length > 0) {
    return placard.oneLineAddress;
  }
  const raw = placard.address;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (raw && typeof raw === "object") {
    const addr = raw as Record<string, unknown>;
    const street =
      addr.streetAddress ?? addr.addressLine1 ?? addr.street ?? addr.lineOne;
    if (typeof street === "string") {
      const parts = [
        street,
        typeof addr.city === "string" ? addr.city : undefined,
        typeof addr.state === "string" ? addr.state : undefined,
        typeof (addr.zip ?? addr.zipCode ?? addr.postalCode) === "string"
          ? (addr.zip ?? addr.zipCode ?? addr.postalCode)
          : undefined,
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(", ");
    }
  }
  for (const key of ["streetAddress", "addressLine1", "fullAddress"]) {
    const value = placard[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "Address available on original listing";
}

function pickCoord(
  value: Record<string, unknown>,
  latKeys: string[],
  lngKeys: string[],
): { lat: number; lng: number } | null {
  let lat: number | null = null;
  for (const key of latKeys) {
    lat = pickNumber(value[key]);
    if (lat !== null) break;
  }
  if (lat === null) return null;
  let lng: number | null = null;
  for (const key of lngKeys) {
    lng = pickNumber(value[key]);
    if (lng !== null) break;
  }
  if (lng === null) return null;
  return { lat, lng };
}

function pickRent(value: Record<string, unknown>): number | null {
  const direct = pickNumber(value.rent) ?? pickNumber(value.price) ?? pickNumber(value.minRent);
  if (direct !== null) return direct;
  const rent = value.rent;
  if (rent && typeof rent === "object") {
    const r = rent as Record<string, unknown>;
    const n = pickNumber(r.min) ?? pickNumber(r.minimum) ?? pickNumber(r.low);
    if (n !== null) return n;
  }
  if (typeof rent === "string") {
    const match = rent.match(/\$?\s*([\d,.]+)/);
    if (match) return Number.parseFloat(match[1].replace(/,/g, ""));
  }
  const range =
    parseRangeRange(value.rentRange ?? value.priceRange).min ??
    parseRangeRange(String(value.rent ?? "")).min;
  return range;
}

function normalizeApartmentsListing(placard: Record<string, unknown>): Listing | null {
  const addressObj =
    placard.address && typeof placard.address === "object"
      ? (placard.address as Record<string, unknown>)
      : {};
  const coords =
    pickCoord(placard, ["lat", "latitude"], ["lng", "lon", "longitude"]) ??
    pickCoord(addressObj, ["lat", "latitude"], ["lng", "lon", "longitude"]);
  const price = pickRent(placard);
  if (coords === null || price === null) return null;
  const { lat, lng } = coords;

  const photos: string[] = [];
  for (const key of ["photos", "photoUrls", "images", "photo"]) {
    const raw = placard[key];
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === "string" && item.length > 0) photos.push(item);
        else if (item && typeof item === "object") {
          const u = (item as Record<string, unknown>).url ?? (item as Record<string, unknown>).photoUrl;
          if (typeof u === "string" && u.length > 0) photos.push(u);
        }
      }
    } else if (typeof raw === "string" && raw.length > 0) {
      photos.push(raw);
    }
  }
  if (
    typeof placard.primaryImage === "string" &&
    placard.primaryImage.length > 0 &&
    !photos.includes(placard.primaryImage)
  ) {
    photos.push(placard.primaryImage);
  }
  const photosLarger = photos.map(toProxyImageUrl);

  const listingKey = String(placard.listingKey ?? placard.listing_id ?? placard.id ?? "");

  return {
    id: listingKey.length > 0 ? listingKey : `${lat},${lng}`,
    title:
      typeof placard.name === "string" && placard.name.length > 0
        ? placard.name
        : typeof placard.title === "string"
          ? placard.title
          : "Rental property",
    description:
      typeof placard.description === "string" && placard.description.length > 0
        ? placard.description
        : undefined,
    price,
    bedrooms:
      pickNumber(placard.bedrooms) ??
      pickNumber(placard.beds) ??
      parseBedRange(placard.bedRange),
    bathrooms: pickNumber(placard.bathrooms) ?? pickNumber(placard.baths),
    sqft:
      pickNumber(placard.squareFootage) ??
      pickNumber(placard.sqft) ??
      pickNumber(placard.area) ??
      pickNumber(placard.livingArea),
    address: pickAddress(placard),
    city:
      typeof placard.city === "string"
        ? placard.city
        : typeof addressObj.city === "string"
          ? addressObj.city
          : undefined,
    state:
      typeof placard.state === "string"
        ? placard.state
        : typeof addressObj.state === "string"
          ? addressObj.state
          : undefined,
    zip: (() => {
      const raw =
        placard.zip ?? placard.zipCode ?? placard.postalCode ?? addressObj.postalCode;
      return typeof raw === "string" ? raw : undefined;
    })(),
    lat,
    lng,
    images: photosLarger.slice(0, 8),
    propertyType:
      typeof placard.propertyType === "string"
        ? placard.propertyType
        : typeof placard.type === "string"
          ? placard.type
          : "Property",
    isMock: false,
  };
}

// ---- Deterministic mock listings so the site works without any API key ----

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...values: number[]): number {
  let h = 2166136261;
  for (const v of values) {
    h ^= Math.round(v * 1000);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const STREETS = [
  "Maple Ave",
  "Oak Street",
  "Cedar Lane",
  "Birchwood Dr",
  "Willow Ct",
  "Elm Street",
  "Pine Road",
  "Sunset Blvd",
  "Lakeview Dr",
  "Hillcrest Ave",
  "Rosewood Way",
  "Meadow Ln",
  "Highland Ave",
  "Park Place",
  "Greenwood Rd",
  "Chestnut St",
  "Magnolia Dr",
  "Juniper Ct",
  "Franklin St",
  "Harrison Ave",
];

const TYPES = ["House", "Apartment", "Townhouse", "Condo", "Duplex"];

const DESCRIPTIONS = [
  "Bright and spacious unit in a well-maintained building. Freshly painted, hardwood floors throughout, and a private balcony overlooking a quiet street.",
  "Charming home with a large fenced backyard, updated kitchen with stainless steel appliances, and plenty of natural light. Walking distance to shops and parks.",
  "Modern open-concept layout featuring an upgraded kitchen island, in-unit laundry, and a dedicated parking spot. Close to public transit and major highways.",
  "Recently renovated with new flooring, recessed lighting, and energy-efficient windows. Includes access to shared amenities like a gym and courtyard.",
  "Cozy and move-in ready. Features central heating and cooling, generous closet space, and a pet-friendly community with on-site management.",
];

const REGION_FACTORS = [0.85, 0.95, 1.05, 1.2, 1.35, 1.55];

function offsetFromCenter(
  lat: number,
  lng: number,
  bearingDeg: number,
  miles: number,
): [number, number] {
  const R = 3958.8;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const dLat = (miles / R) * Math.cos(bearing);
  const dLng = (miles / (R * Math.cos(lat1))) * Math.sin(bearing);
  return [lat + (dLat * 180) / Math.PI, lng + (dLng * 180) / Math.PI];
}

export function generateMockListings(
  lat: number,
  lng: number,
  label: string,
  filters: Filters,
): Listing[] {
  const rand = mulberry32(hashSeed(lat, lng));
  const regionFactor = REGION_FACTORS[Math.floor(rand() * REGION_FACTORS.length)];
  const count = 18 + Math.floor(rand() * 10);
  const listings: Listing[] = [];

  const city =
    label.split(",")[0]?.trim() || "Downtown";
  const state =
    label.split(",").find((part) => /^[A-Z]{2}$/.test(part.trim()))?.trim() || "US";

  for (let i = 0; i < count; i++) {
    const bearing = rand() * 360;
    const miles = rand() * filters.radiusMiles * 0.9;
    const [hLat, hLng] = offsetFromCenter(lat, lng, bearing, miles);
    const type = TYPES[Math.floor(rand() * TYPES.length)];
    const bedrooms = 1 + Math.floor(rand() * 5);
    const bathrooms = bedrooms > 3 ? 2.5 : bedrooms > 1 ? 1 + rand() : 1;
    const sqft = 550 + bedrooms * 340 + Math.floor(rand() * 400);
    const price = Math.round(
      (1100 + bedrooms * 450 + sqft * 0.55) * regionFactor * (0.85 + rand() * 0.35),
    );
    const street = STREETS[Math.floor(rand() * STREETS.length)];
    const number = 100 + Math.floor(rand() * 8900);

    if (filters.maxPrice !== null && price > filters.maxPrice) continue;
    if (filters.minBeds !== null && bedrooms < filters.minBeds) continue;
    if (filters.propertyType !== null && type.toLowerCase() !== filters.propertyType.toLowerCase())
      continue;

    listings.push({
      id: `mock-${i}-${hashSeed(lat, lng)}`,
      title: `${type === "Apartment" ? "Apartment" : `${type} rental`} near ${city}`,
      description: DESCRIPTIONS[Math.floor(rand() * DESCRIPTIONS.length)],
      price,
      bedrooms,
      bathrooms,
      sqft,
      address: `${number} ${street}`,
      city,
      state,
      lat: hLat,
      lng: hLng,
      images: [
        `https://picsum.photos/seed/rent-${i}-${Math.round(lat * 100)}-${Math.round(lng * 100)}/800/600`,
        `https://picsum.photos/seed/rent-${i}-b-${Math.round(lat * 100)}/800/600`,
      ],
      propertyType: type,
      isMock: true,
    });
  }

  return listings
    .sort((a, b) => haversineMiles(lat, lng, a.lat, a.lng) - haversineMiles(lat, lng, b.lat, b.lng))
    .slice(0, 24);
}