import { createGridCandidates } from "./demo";
import { getCellById, GRID_SIZE_METERS } from "./grid";
import type { AnalysisSelection } from "../types/analysis";
import type { AnalysisGridRequest } from "../types/analysis-request";

/** Shared by the live preview and the request snapshot; never rounds coordinates. */
export function createAnalysisGridRequest(selection: AnalysisSelection | null): AnalysisGridRequest {
  return {
    crs: "EPSG:4326",
    gridCrs: "EPSG:5179",
    gridSizeMeters: GRID_SIZE_METERS,
    grids: selection ? createGridCandidates(selection).map(candidate => {
      const cell = getCellById(candidate.gridId)!;
      return {
        gridId: cell.id,
        label: candidate.label,
        southWest: { ...cell.corners[0] },
        northEast: { ...cell.corners[2] },
      };
    }) : [],
  };
}
