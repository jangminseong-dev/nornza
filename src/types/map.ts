export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface GridCell {
  id: string;
  column: number;
  row: number;
  center: GeoPoint;
  corners: GeoPoint[];
}

export interface MapRegion {
  name: string;
  breadcrumbs: string[];
}

export interface MapTarget extends GeoPoint {
  requestId: number;
  label: string;
  level?: number;
}

export interface MapAnnotation {
  id: string;
  point: GeoPoint;
  label: string;
  description?: string;
  tone: "candidate" | "selected" | "completed" | "processing" | "prospect";
  active?: boolean;
  gridIds?: readonly string[];
  variant?: "grid-score";
}

export interface PlaceResult extends GeoPoint {
  id: string;
  name: string;
  address: string;
  kind: "place" | "address";
  category?: string;
  url?: string;
}
