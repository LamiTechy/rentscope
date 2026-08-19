# RentScope — Rental finder for the US

Search any US address, city, or ZIP code and see available rentals around it on a map, with filters for radius, price, beds, and property type.

## Tech stack

- **Next.js 16 (App Router, TypeScript, Tailwind)** — frontend + API routes
- **React Leaflet / OpenStreetMap** — map + tiles (free, no key)
- **Nominatim (OSM)** — geocoding via a server-side proxy (rate-limited + cached)
- **RealtyAPI (Apartments.com data)** — live US rental listings (free tier: 250 requests/month)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The site works out of the box with built-in **sample listings** (deterministic mock data generated around the searched location). To load real rental listings:

1. Get a free API key at https://www.realtyapi.io/pricing (250 requests/month, no credit card).
2. Copy `.env.example` to `.env.local` and paste your key:

```
REALTYAPI_KEY=your_key_here
```

3. Restart the dev server. The results panel will show a "Live data" badge.

## How it works

1. User types an address → `/api/geocode` proxies Nominatim (cached, 1 req/s throttled) → lat/lng + display label with live suggestions.
2. `/api/listings` calls RealtyAPI's Apartments.com search (`/search/bylocation` with the resolved location), filters by radius/price/beds/type, sorts by distance — or falls back to mock data when no key is set or the API fails.
3. Results render as cards + map markers with a search-radius circle. Clicking a card or marker opens a detail view with image gallery and link to the original listing.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint
