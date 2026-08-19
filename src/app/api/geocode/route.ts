import type { NextRequest } from "next/server";
import { geocode } from "@/lib/geocode";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 3) {
    return Response.json({ results: [] });
  }

  try {
    const results = await geocode(q);
    return Response.json({ results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Geocoding failed" },
      { status: 502 },
    );
  }
}