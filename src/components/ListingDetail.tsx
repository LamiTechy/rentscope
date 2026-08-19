"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import type { Listing } from "@/lib/types";
import { formatPrice } from "./ListingCard";

interface ListingDetailProps {
  listing: Listing | null;
  onClose: () => void;
}

export default function ListingDetail({ listing, onClose }: ListingDetailProps) {
  const [photos, setPhotos] = useState<string[]>(listing?.images ?? []);
  const [imageIndex, setImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [detailBaths, setDetailBaths] = useState<number | null>(listing?.bathrooms ?? null);
  const [detailSqft, setDetailSqft] = useState<number | null>(listing?.sqft ?? null);

  useEffect(() => {
    if (!listing || listing.isMock || !listing.id) return;

    let cancelled = false;
    fetch(`/api/photos?listingKey=${encodeURIComponent(listing.id)}`)
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ photos?: string[]; baths?: number | null; sqft?: number | null }>)
          : null,
      )
      .then((data) => {
        if (cancelled || !data) return;
        const hi = (data.photos ?? []).filter((p): p is string => typeof p === "string");
        if (hi.length > 0) setPhotos(hi);
        if (typeof data.baths === "number") setDetailBaths(data.baths);
        if (typeof data.sqft === "number") setDetailSqft(data.sqft);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!listing) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")
        setImageIndex((i) => (i - 1 + photos.length) % Math.max(1, photos.length));
      if (e.key === "ArrowRight")
        setImageIndex((i) => (i + 1) % Math.max(1, photos.length));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [listing, onClose, photos.length]);

  if (!listing) return null;

  const hasImages = photos.length > 0 && !failedImages.has(imageIndex);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-64 shrink-0 bg-zinc-100 sm:h-80">
          {hasImages ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photos[imageIndex]}
              alt={listing.title}
              onError={() =>
                setFailedImages((prev) => new Set(prev).add(imageIndex))
              }
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <Building2 className="size-16" strokeWidth={1.5} />
            </div>
          )}

          {hasImages && photos.length > 1 && (
            <>
              <button
                onClick={() =>
                  setImageIndex((i) => (i - 1 + photos.length) % photos.length)
                }
                aria-label="Previous image"
                className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-900/60 text-white backdrop-blur transition-colors hover:bg-zinc-900/80"
              >
                ‹
              </button>
              <button
                onClick={() => setImageIndex((i) => (i + 1) % photos.length)}
                aria-label="Next image"
                className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-900/60 text-white backdrop-blur transition-colors hover:bg-zinc-900/80"
              >
                ›
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900/60 px-2.5 py-1 text-xs text-white">
                {imageIndex + 1} / {photos.length}
              </div>
            </>
          )}

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-zinc-900/60 text-white backdrop-blur transition-colors hover:bg-zinc-900/80"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-zinc-900">
                  {formatPrice(listing.price)}
                </span>
                <span className="text-sm text-zinc-500">/month</span>
              </div>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900">{listing.title}</h2>
              <p className="text-sm text-zinc-500">{listing.address}</p>
              <p className="text-xs text-zinc-400">
                {[listing.city, listing.state, listing.zip].filter(Boolean).join(", ") ||
                  "United States"}
              </p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {listing.propertyType}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-zinc-50 p-3 text-center">
            <div>
              <div className="text-lg font-bold text-zinc-900">
                {listing.bedrooms ?? "—"}
              </div>
              <div className="text-xs text-zinc-500">Bedrooms</div>
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-900">
                {detailBaths ?? "—"}
              </div>
              <div className="text-xs text-zinc-500">Bathrooms</div>
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-900">
                {detailSqft ? detailSqft.toLocaleString() : "—"}
              </div>
              <div className="text-xs text-zinc-500">Sq ft</div>
            </div>
          </div>

          {listing.description && (
            <p className="mt-4 text-sm leading-relaxed text-zinc-600">
              {listing.description}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Close
            </button>
          </div>

          {listing.isMock && (
            <p className="mt-3 text-center text-xs text-zinc-400">
              Sample listing — connect an API key for real rental data.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}