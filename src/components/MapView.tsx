"use client";

import { useEffect, useMemo } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Listing } from "@/lib/types";

interface MapViewProps {
  listings: Listing[];
  center: { lat: number; lng: number };
  radiusMiles: number;
  selectedId: string | null;
  onSelect: (listing: Listing) => void;
  className?: string;
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    const k = price / 1000;
    return `$${k >= 10 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `$${price}`;
}

function FitBounds({ listings, center }: { listings: Listing[]; center: { lat: number; lng: number } }) {
  const map = useMap();

  useEffect(() => {
    if (listings.length === 0) {
      map.setView([center.lat, center.lng], 12);
      return;
    }
    const points: [number, number][] = [[center.lat, center.lng]];
    for (const l of listings) points.push([l.lat, l.lng]);
    map.fitBounds(L.latLngBounds(points.map(([a, b]) => L.latLng(a, b))), {
      padding: [40, 40],
      maxZoom: 15,
    });
  }, [listings, center, map]);

  return null;
}

export default function MapView({
  listings,
  center,
  radiusMiles,
  selectedId,
  onSelect,
  className = "",
}: MapViewProps) {
  const radiusMeters = useMemo(() => radiusMiles * 1609.34, [radiusMiles]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      scrollWheelZoom
      className={`z-0 h-full w-full ${className}`}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FitBounds listings={listings} center={center} />

      <Circle
        center={[center.lat, center.lng]}
        radius={radiusMeters}
        pathOptions={{
          color: "#059669",
          weight: 1,
          fillColor: "#059669",
          fillOpacity: 0.08,
          dashArray: "4 4",
        }}
      />

      {listings.map((l) => {
        const active = l.id === selectedId;
        const icon = L.divIcon({
          className: "",
          html: `<div class="rental-pin ${active ? "rental-pin--active" : ""}"><span>${formatPrice(l.price)}</span></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          popupAnchor: [0, -28],
        });
        return (
          <Marker
            key={l.id}
            position={[l.lat, l.lng]}
            icon={icon}
            eventHandlers={{ click: () => onSelect(l) }}
          >
            <Popup>
              <div className="min-w-44 font-sans">
                <div className="text-sm font-semibold text-emerald-700">
                  {formatPrice(l.price)}/mo
                </div>
                <div className="text-xs text-zinc-600">
                  {l.bedrooms !== null ? `${l.bedrooms} bd` : "—"} ·{" "}
                  {l.bathrooms !== null ? `${l.bathrooms} ba` : "—"} · {l.propertyType}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 line-clamp-1">{l.address}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}