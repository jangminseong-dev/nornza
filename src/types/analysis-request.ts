import type { GeoPoint } from "./map";

export interface AnalysisRequestGrid {
  gridId: string;
  label: string;
  /** Actual southwest vertex of the EPSG:5179 cell, transformed to WGS84. */
  southWest: GeoPoint;
  /** Actual northeast vertex of the EPSG:5179 cell, transformed to WGS84. */
  northEast: GeoPoint;
}

/** Coordinate portion of the future analysis API request. */
export interface AnalysisGridRequest {
  crs: "EPSG:4326";
  gridCrs: "EPSG:5179";
  gridSizeMeters: number;
  grids: AnalysisRequestGrid[];
}
