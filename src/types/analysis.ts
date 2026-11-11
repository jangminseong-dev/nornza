/** Values supplied by a future map selection. Missing values stay empty in the UI. */
export interface AnalysisRegionStatistics {
  residentPopulation: number | null;
  floatingPopulation: number | null;
  cuStoreCount: number | null;
  competingStoreCount: number | null;
  commercialType: string | null;
}

/** One analysis area can contain several square map cells. */
export interface AnalysisSelection {
  gridIds: readonly string[];
  address: string | null;
  breadcrumbs: readonly string[];
  areaSquareMeters: number | null;
  statistics: AnalysisRegionStatistics;
}

export type AnalysisSelectionMode = "administrative" | "grid";
