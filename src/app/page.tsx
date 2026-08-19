"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Building2, Check, SearchX } from "lucide-react";
import type { Filters, GeocodeResult, ListingsResponse, Listing } from "@/lib/types";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import ListingCard from "@/components/ListingCard";
import ListingDetail from "@/components/ListingDetail";
import { toApiLocation } from "@/lib/geocode";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
      Loading map…
    </div>
  ),
});

const DEFAULT_FILTERS: Filters = {
  radiusMiles: 10,
  maxPrice: null,
  minBeds: null,
  propertyType: null,
};

export default function Home() {
  const [searched, setSearched] = useState(false);
  const [location, setLocation] = useState<GeocodeResult | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [source, setSource] = useState<ListingsResponse["source"]>("mock");  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [searchLabel, setSearchLabel] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const runSearch = useCallback(async (loc: GeocodeResult, f: Filters) => {
    setLoading(true);
    setError(null);
    const id = ++requestId.current;
    const params = new URLSearchParams({
      lat: String(loc.lat),
      lng: String(loc.lng),
      label: toApiLocation(loc),
      radius: String(f.radiusMiles),
    });
    if (f.maxPrice !== null) params.set("maxPrice", String(f.maxPrice));
    if (f.minBeds !== null) params.set("minBeds", String(f.minBeds));
    if (f.propertyType) params.set("type", f.propertyType);

    try {
      const res = await fetch(`/api/listings?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load listings");
      const data = (await res.json()) as ListingsResponse;
      if (id !== requestId.current) return;
      setListings(data.listings);
      setSource(data.source);
      setSearchLabel(data.query.label);
      setSelected(null);
    } catch (e) {
      if (id === requestId.current) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setListings([]);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const handleSelectLocation = useCallback(
    (loc: GeocodeResult) => {
      setLocation(loc);
      setSearched(true);
      setFilters(DEFAULT_FILTERS);
      if (!loc.city && !loc.zip) {
        setListings([]);
        setSource("mock");
        setSearchLabel(loc.label);
        setSelected(null);
        const stateName = loc.label.split(",")[0]?.trim() || "That";
        setError(
          `"${stateName}" is a whole state — try a city or ZIP code instead (e.g. "Los Angeles, CA" or "90210").`,
        );
        return;
      }
      runSearch(loc, DEFAULT_FILTERS);
    },
    [runSearch],
  );

  const handleFilterChange = useCallback(
    (f: Filters) => {
      setFilters(f);
      if (location) runSearch(location, f);
    },
    [location, runSearch],
  );

  const handleSelectListing = useCallback((l: Listing) => {
    setSelected(l);
  }, []);

  if (!searched) {
    return (
      <div className="flex flex-1 flex-col">
        <section className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-20">
          <h1 className="max-w-2xl text-center text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            Find your next <span className="text-emerald-600">home</span> anywhere in the US
          </h1>
          <p className="mt-4 max-w-xl text-center text-lg text-zinc-500">
            Search any address, city, or ZIP code and see available rentals around it — right on
            the map.
          </p>
          <div className="mt-8 w-full max-w-2xl">
            <SearchBar
              onSelect={handleSelectLocation}
              size="lg"
              autoFocus
            />
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <span className="flex items-center gap-2">
              <Check className="size-4 text-emerald-600" strokeWidth={2.5} /> 3.6M+ live listings
            </span>
            <span className="flex items-center gap-2">
              <Check className="size-4 text-emerald-600" strokeWidth={2.5} /> Free &amp; no sign-up
            </span>
            <span className="flex items-center gap-2">
              <Check className="size-4 text-emerald-600" strokeWidth={2.5} /> Filter by price, beds &amp; type
            </span>
          </div>
        </section>
        <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-400">
          Rental listings via{" "}
          <a
            href="https://www.apartments.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-500 underline-offset-2 hover:underline"
          >
            Apartments.com
          </a>{" "}
          data · Geocoding &amp; maps ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-zinc-500 underline-offset-2 hover:underline"
          >
            OpenStreetMap
          </a>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="z-10 flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => {
            setSearched(false);
            setListings([]);
            setSelected(null);
          }}
          className="flex items-center gap-1.5 text-lg font-extrabold tracking-tight text-zinc-900"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-sm text-white">
              <Building2 className="size-4" strokeWidth={2.5} />
            </span>
          <span className="hidden sm:inline">RentScope</span>
        </button>
        <div className="mx-auto w-full max-w-xl">
          <SearchBar onSelect={handleSelectLocation} defaultValue={searchLabel} />
        </div>
      </header>

      <FilterBar
        filters={filters}
        resultCount={listings.length}
        source={source}
        onChange={handleFilterChange}
      />

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col border-r border-zinc-200 lg:w-[440px] lg:shrink-0 lg:basis-[440px]">
          <div className="flex items-center justify-between px-4 py-2.5">
            <h2 className="text-sm font-semibold text-zinc-700">
              {loading ? "Searching…" : `${listings.length} rentals near ${searchLabel.split(",")[0]}`}
            </h2>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {loading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-36 animate-pulse rounded-2xl bg-zinc-100"
                  />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && listings.length === 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
                <div className="text-3xl">
                  <SearchX className="mx-auto size-12 text-zinc-300" strokeWidth={1.5} />
                </div>
                <p className="mt-2 font-medium text-zinc-700">No rentals found</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Try widening the radius or removing filters.
                </p>
              </div>
            )}

            {!loading && !error && listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                active={selected?.id === l.id}
                onSelect={handleSelectListing}
              />
            ))}
          </div>
        </div>

        <div className="relative h-[45vh] shrink-0 lg:h-auto lg:flex-1">
          {location && (
            <MapView
              listings={listings}
              center={{ lat: location.lat, lng: location.lng }}
              radiusMiles={filters.radiusMiles}
              selectedId={selected?.id ?? null}
              onSelect={handleSelectListing}
            />
          )}
        </div>
      </main>

      <ListingDetail
        key={selected?.id ?? "none"}
        listing={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}