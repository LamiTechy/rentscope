import type { NextRequest } from "next/server";
import { fetchListingDetails } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const listingKey = request.nextUrl.searchParams.get("listingKey") ?? "";
  if (!listingKey) return Response.json({ photos: [], baths: null, sqft: null });

  try {
    const details = await fetchListingDetails(listingKey);
    return Response.json(details);
  } catch {
    return Response.json({ photos: [], baths: null, sqft: null });
  }
}