import type { AnalysisSelection } from "../types/analysis";
import type { MapRegion } from "../types/map";
import { getCellById, GRID_SIZE_METERS } from "./grid";

// FNV-1a supplies stable sample values without time, random, or network state.
function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
}

/** Simulated values only. Replace this per-cell source with real data later. */
export function createMockSelection(
  ids: readonly string[],
  region: MapRegion | null,
): AnalysisSelection | null {
  const gridIds = [...new Set(ids)].filter((id) => getCellById(id) !== null).sort();
  if (gridIds.length === 0) return null;

  let residentPopulation = 0;
  let floatingPopulation = 0;
  let cuStoreCount = 0;
  let competingStoreCount = 0;

  for (const id of gridIds) {
    residentPopulation += 40 + (hash(`${id}:resident`) % 311);
    floatingPopulation += 200 + (hash(`${id}:floating`) % 1301);
    cuStoreCount += hash(`${id}:cu`) % 5 === 0 ? 1 : 0;
    competingStoreCount += hash(`${id}:competitor`) % 3;
  }

  const populationRatio = floatingPopulation / residentPopulation;
  const commercialType =
    populationRatio > 5
      ? "오피스 중심"
      : populationRatio < 2.5
        ? "주거 중심"
        : "오피스 / 주거 혼합";

  return {
    gridIds,
    address: region?.name ?? "선택한 그리드",
    breadcrumbs: [...(region?.breadcrumbs ?? [])],
    areaSquareMeters: GRID_SIZE_METERS ** 2 * gridIds.length,
    statistics: {
      residentPopulation,
      floatingPopulation,
      cuStoreCount,
      competingStoreCount,
      commercialType,
    },
  };
}
