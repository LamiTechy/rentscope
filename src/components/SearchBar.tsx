"use client";

import { useEffect, useRef, useState } from "react";
import type { GeocodeResult } from "@/lib/types";

interface SearchBarProps {
  onSelect: (location: GeocodeResult) => void;
  defaultValue?: string;
  size?: "lg" | "md";
  autoFocus?: boolean;
}

export default function SearchBar({
  onSelect,
  defaultValue = "",
  size = "md",
  autoFocus = false,
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const q = query.trim();
    if (q.length < 3) return;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Geocoding failed");
        const data = (await res.json()) as { results: GeocodeResult[] };
        setSuggestions(data.results);
        setOpen(data.results.length > 0);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Could not find that address");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setError(null);
    }
  }

  function pick(result: GeocodeResult) {
    setQuery(result.label);
    setOpen(false);
    setSuggestions([]);
    onSelect(result);
  }

  function submit() {
    const q = query.trim();
    if (q.length < 3) return;
    if (suggestions.length > 0) {
      pick(suggestions[0]);
    } else {
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: { results: GeocodeResult[] }) => {
          if (data.results.length > 0) pick(data.results[0]);
          else setError("No matches — try a city, ZIP, or full address");
        })
        .catch(() => setError("Could not find that address"));
    }
  }

  const big = size === "lg";

  return (
    <div ref={rootRef} className="relative w-full">
      <div
        className={`flex items-stretch gap-2 rounded-2xl border border-zinc-200 bg-white shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 ${big ? "p-2" : "p-1.5"}`}
      >
        <svg
          className={`ml-2 mt-auto mb-auto shrink-0 text-zinc-400 ${big ? "size-5" : "size-4"}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
          />
        </svg>
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search any US address, city, or ZIP code"
          aria-label="Search address"
          className={`w-full bg-transparent text-zinc-900 outline-none placeholder:text-zinc-400 ${big ? "px-1 text-lg" : "px-1 text-sm"}`}
        />
        {loading && (
          <div className="my-auto size-4 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-500" />
        )}
        <button
          onClick={submit}
          disabled={query.trim().length < 3}
          className={`shrink-0 rounded-xl bg-emerald-600 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${big ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"}`}
        >
          Search
        </button>
      </div>

      {error && <p className="mt-1.5 px-1 text-xs text-red-600">{error}</p>}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
          {suggestions.map((s, i) => (
            <li key={`${s.lat},${s.lng}-${i}`}>
              <button
                onClick={() => pick(s)}
                className="flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-emerald-50"
              >
                <svg
                  className="mt-0.5 size-4 shrink-0 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                  />
                </svg>
                <span className="line-clamp-2">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}