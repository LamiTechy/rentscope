"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import type { Listing } from "@/lib/types";

interface ListingCardProps {
  listing: Listing;
  active?: boolean;
  onSelect: (listing: Listing) => void;
}

export function formatPrice(price: number): string {
  return `$${price.toLocaleString()}`;
}

export default function ListingCard({ listing, active = false, onSelect }: ListingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = listing.images.length > 0 && !imageFailed;

  return (
    <button
      onClick={() => onSelect(listing)}
      className={`group flex w-full gap-3 rounded-2xl border bg-white p-3 text-left transition-all hover:shadow-md ${
        active ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-zinc-200"
      }`}
    >
      <div className="relative h-28 w-36 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt={listing.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <Building2 className="size-10" strokeWidth={1.5} />
          </div>
        )}
        {listing.isMock && (
          <span className="absolute top-1.5 left-1.5 rounded-md bg-zinc-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Sample
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-bold text-zinc-900">{formatPrice(listing.price)}</span>
          <span className="text-[11px] text-zinc-400">/mo</span>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-600">
          <span>{listing.bedrooms !== null ? `${listing.bedrooms} bd` : "— bd"}</span>
          <span className="text-zinc-300">·</span>
          <span>{listing.bathrooms !== null ? `${listing.bathrooms} ba` : "— ba"}</span>
          <span className="text-zinc-300">·</span>
          <span>{listing.sqft !== null ? `${listing.sqft.toLocaleString()} sqft` : "— sqft"}</span>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5">{listing.propertyType}</span>
        </div>

        <div className="mt-1 truncate text-sm text-zinc-700">{listing.address}</div>
        <div className="truncate text-xs text-zinc-400">
          {[listing.city, listing.state, listing.zip].filter(Boolean).join(", ") || "United States"}
        </div>
      </div>
    </button>
  );
}