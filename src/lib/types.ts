export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface Listing {
  id: string;
  title: string;
  description?: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  lat: number;
  lng: number;
  images: string[];
  propertyType: string;
  isMock: boolean;
}

export interface ListingsResponse {
  listings: Listing[];
  source: "live" | "mock";
  query: {
    lat: number;
    lng: number;
    radiusMiles: number;
    label: string;
  };
}

export interface Filters {
  radiusMiles: number;
  maxPrice: number | null;
  minBeds: number | null;
  propertyType: string | null;
}