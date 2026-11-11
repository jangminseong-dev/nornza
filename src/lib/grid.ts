import proj4 from "proj4";
import type { GeoBounds, GeoPoint, GridCell } from "../types/map";

export const GRID_SIZE_METERS = 100;

// Korea 2000 (now named KGD2002) / Unified CS. Parameters and area of use:
// https://opengeospatial.github.io/ontology-crs/data/def/crs/EPSG/0/5179/index.html
// proj4 uses [easting, northing] / [longitude, latitude], independently of
// the EPSG registry's northing-first axis metadata.
const GRID_PROJECTION =
  "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs";
const projection = proj4("EPSG:4326", GRID_PROJECTION);
const AREA: GeoBounds = {
  south: 28.6,
  west: 122.71,
  north: 40.27,
  east: 134.28,
};
const ID_PREFIX = `5179:${GRID_SIZE_METERS}`;
const EDGE_TOLERANCE_METERS = 0.00001;
const ABSOLUTE_CELL_LIMIT = 10_000;

function isInArea(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= AREA.south &&
    point.lat <= AREA.north &&
    point.lng >= AREA.west &&
    point.lng <= AREA.east
  );
}

function toGeographic(easting: number, northing: number): GeoPoint {
  const [lng, lat] = projection.inverse([easting, northing]);
  return { lat, lng };
}

// A geographic/projected round trip can move an exact edge by a few nanometres.
// Snap only that numerical noise; cells otherwise use half-open [min, max) edges.
function gridCoordinate(meters: number): number {
  const units = meters / GRID_SIZE_METERS;
  const nearest = Math.round(units);
  return Math.abs(units - nearest) * GRID_SIZE_METERS <= EDGE_TOLERANCE_METERS
    ? nearest
    : units;
}

function createCell(column: number, row: number): GridCell {
  const west = column * GRID_SIZE_METERS;
  const south = row * GRID_SIZE_METERS;
  const east = west + GRID_SIZE_METERS;
  const north = south + GRID_SIZE_METERS;

  return {
    id: `${ID_PREFIX}:${column}:${row}`,
    column,
    row,
    center: toGeographic(west + GRID_SIZE_METERS / 2, south + GRID_SIZE_METERS / 2),
    // Counter-clockwise, without a repeated closing vertex; map SDKs close it.
    corners: [
      toGeographic(west, south),
      toGeographic(east, south),
      toGeographic(east, north),
      toGeographic(west, north),
    ],
  };
}

function cellOverlapsArea(cell: GridCell): boolean {
  const latitudes = cell.corners.map((point) => point.lat);
  const longitudes = cell.corners.map((point) => point.lng);
  return (
    Math.min(...latitudes) <= AREA.north &&
    Math.max(...latitudes) >= AREA.south &&
    Math.min(...longitudes) <= AREA.east &&
    Math.max(...longitudes) >= AREA.west
  );
}

/** Fixed 100 m projected cells; panning/zooming never changes their identity. */
export function getCellAtPoint(point: GeoPoint): GridCell {
  if (!isInArea(point)) {
    throw new RangeError("The point is outside the EPSG:5179 area of use.");
  }

  const [easting, northing] = projection.forward([point.lng, point.lat]);
  return createCell(
    Math.floor(gridCoordinate(easting)),
    Math.floor(gridCoordinate(northing)),
  );
}

/** Reject noncanonical IDs and coordinates outside this Korean grid. */
export function getCellById(id: string): GridCell | null {
  const match = /^5179:100:(0|[1-9]\d{0,4}):(0|[1-9]\d{0,4})$/.exec(id);
  if (!match || match[0] !== id) return null;

  const column = Number(match[1]);
  const row = Number(match[2]);
  // This wide envelope includes the CRS area and prevents extreme projections.
  if (column < 5_000 || column > 17_000 || row < 9_000 || row > 23_000) return null;

  const cell = createCell(column, row);
  return cellOverlapsArea(cell) ? cell : null;
}

/**
 * Returns the projected envelope of the visible geographic rectangle.
 * A view exceeding the limit returns no cells, so zoomed-out views cannot
 * silently show a biased partial grid. Callers should prompt users to zoom in.
 */
export function getVisibleCells(bounds: GeoBounds, maxCells = 1_000): GridCell[] {
  if (
    ![bounds.south, bounds.west, bounds.north, bounds.east].every(Number.isFinite) ||
    bounds.south >= bounds.north ||
    bounds.west >= bounds.east ||
    bounds.south < -90 ||
    bounds.north > 90 ||
    bounds.west < -180 ||
    bounds.east > 180 ||
    !Number.isSafeInteger(maxCells) ||
    maxCells < 1
  ) {
    return [];
  }

  const south = Math.max(bounds.south, AREA.south);
  const west = Math.max(bounds.west, AREA.west);
  const north = Math.min(bounds.north, AREA.north);
  const east = Math.min(bounds.east, AREA.east);
  if (south >= north || west >= east) return [];

  const projected = [
    projection.forward([west, south]),
    projection.forward([east, south]),
    projection.forward([east, north]),
    projection.forward([west, north]),
  ];
  const columns = projected.map(([x]) => gridCoordinate(x));
  const rows = projected.map(([, y]) => gridCoordinate(y));
  const minColumn = Math.floor(Math.min(...columns));
  const minRow = Math.floor(Math.min(...rows));
  const maxColumn = Math.max(minColumn, Math.ceil(Math.max(...columns)) - 1);
  const maxRow = Math.max(minRow, Math.ceil(Math.max(...rows)) - 1);
  const count = (maxColumn - minColumn + 1) * (maxRow - minRow + 1);

  if (!Number.isSafeInteger(count) || count > Math.min(maxCells, ABSOLUTE_CELL_LIMIT)) {
    return [];
  }

  const cells: GridCell[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const cell = createCell(column, row);
      if (cellOverlapsArea(cell)) cells.push(cell);
    }
  }
  return cells;
}
