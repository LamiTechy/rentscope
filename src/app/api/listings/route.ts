import type { NextRequest } from "next/server";
import type { Filters, ListingsResponse } from "@/lib/types";
import { fetchRealtyApiListings, generateMockListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const label = params.get("label") ?? "";

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "Missing or invalid lat/lng" }, { status: 400 });
  }

  const filters: Filters = {
    radiusMiles: clamp(Number(params.get("radius") ?? 10), 1, 100, 10),
    maxPrice: optionalNumber(params.get("maxPrice"), 200, 50000),
    minBeds: optionalNumber(params.get("minBeds"), 0, 10),
    propertyType: params.get("type")?.trim() || null,
  };

  let listings: Awaited<ReturnType<typeof fetchRealtyApiListings>> = [];
  let source: ListingsResponse["source"] = "mock";

  if (process.env.REALTYAPI_KEY) {
    try {
      listings = await fetchRealtyApiListings(label, lat, lng, filters);
      source = "live";
    } catch (error) {
      console.error("[listings] Apartments API fetch failed, falling back to mock:", error);
      listings = [];
      source = "mock";
    }
  }

  if (source === "mock") {
    listings = generateMockListings(lat, lng, label, filters);
  }

  return Response.json({
    listings,
    source,
    query: { lat, lng, radiusMiles: filters.radiusMiles, label },
  } satisfies ListingsResponse);
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function optionalNumber(raw: string | null, min: number, max: number): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}