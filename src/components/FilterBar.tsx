"use client";

import type { Filters } from "@/lib/types";

interface FilterBarProps {
  filters: Filters;
  resultCount: number;
  source: "live" | "mock";
  onChange: (filters: Filters) => void;
}

const RADII = [2, 5, 10, 20, 50];
const PRICES = [1500, 2000, 3000, 5000, 7500, 10000];
const BEDS = [1, 2, 3, 4, 5];
const TYPES = ["House", "Apartment", "Townhouse", "Condo", "Duplex"];

export default function FilterBar({ filters, resultCount, source, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3">
      <span className="text-sm font-semibold text-zinc-900">
        {resultCount} {resultCount === 1 ? "home" : "homes"}
      </span>

      <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600">
        Within
        <select
          value={filters.radiusMiles}
          onChange={(e) => onChange({ ...filters, radiusMiles: Number(e.target.value) })}
          className="bg-transparent font-medium text-zinc-900 outline-none"
        >
          {RADII.map((r) => (
            <option key={r} value={r}>
              {r} mi
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600">
        Max
        <select
          value={filters.maxPrice ?? ""}
          onChange={(e) =>
            onChange({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : null })
          }
          className="bg-transparent font-medium text-zinc-900 outline-none"
        >
          <option value="">Any</option>
          {PRICES.map((p) => (
            <option key={p} value={p}>
              ${p.toLocaleString()}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600">
        Beds
        <select
          value={filters.minBeds ?? ""}
          onChange={(e) =>
            onChange({ ...filters, minBeds: e.target.value ? Number(e.target.value) : null })
          }
          className="bg-transparent font-medium text-zinc-900 outline-none"
        >
          <option value="">Any</option>
          {BEDS.map((b) => (
            <option key={b} value={b}>
              {b}+
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-600">
        Type
        <select
          value={filters.propertyType ?? ""}
          onChange={(e) =>
            onChange({ ...filters, propertyType: e.target.value || null })
          }
          className="bg-transparent font-medium text-zinc-900 outline-none"
        >
          <option value="">Any</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <span
        className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium ${
          source === "mock"
            ? "bg-amber-100 text-amber-700"
            : "bg-emerald-100 text-emerald-700"
        }`}
        title={
          source === "mock"
            ? "No API key configured — showing sample data"
            : "Live rental listings via Apartments.com (RealtyAPI)"
        }
      >
        {source === "mock" ? "Sample data" : "Live data"}
      </span>
    </div>
  );
}