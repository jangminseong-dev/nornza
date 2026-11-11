import assert from "node:assert/strict";
import test from "node:test";
import { createAnalysisGridRequest } from "../src/lib/analysis-request";
import { createGridCandidates, exampleSelection } from "../src/lib/demo";
import { getCellAtPoint, getCellById, GRID_SIZE_METERS } from "../src/lib/grid";
import type { AnalysisSelection } from "../src/types/analysis";

const anchor = getCellAtPoint({ lat: 36.3518, lng: 127.3874 });

function gridId(columnOffset: number, rowOffset: number) {
  return `5179:100:${anchor.column + columnOffset}:${anchor.row + rowOffset}`;
}

function selectionWithGridIds(gridIds: readonly string[]): AnalysisSelection {
  return { ...exampleSelection(), gridIds };
}

test("null and empty selections have an empty request with explicit coordinate systems", () => {
  const empty = {
    crs: "EPSG:4326",
    gridCrs: "EPSG:5179",
    gridSizeMeters: 100,
    grids: [],
  };
  assert.deepEqual(createAnalysisGridRequest(null), empty);
  assert.deepEqual(createAnalysisGridRequest(selectionWithGridIds([])), empty);
});

test("request grids match candidate count, identity, and labels in north-to-south order", () => {
  const northWest = gridId(0, 1);
  const northEast = gridId(1, 1);
  const southWest = gridId(0, 0);
  const southEast = gridId(1, 0);
  const selection = selectionWithGridIds([southEast, northEast, southWest, northWest]);
  const request = createAnalysisGridRequest(selection);
  const candidates = createGridCandidates(selection);

  assert.equal(request.gridSizeMeters, GRID_SIZE_METERS);
  assert.equal(request.grids.length, 4);
  assert.deepEqual(request.grids.map(({ gridId: id, label }) => ({ gridId: id, label })), candidates.map(({ gridId: id, label }) => ({ gridId: id, label })));
  assert.deepEqual(request.grids.map((grid) => grid.gridId), [northWest, northEast, southWest, southEast]);
  assert.deepEqual(request.grids.map((grid) => grid.label), ["A", "B", "C", "D"]);
  assert.deepEqual(createAnalysisGridRequest(selectionWithGridIds([...selection.gridIds].reverse())), request);
});

test("both WGS84 coordinates exactly preserve the original projected cell vertices", () => {
  const busan = getCellAtPoint({ lat: 35.1796, lng: 129.0756 });
  const selection = selectionWithGridIds([anchor.id, busan.id]);
  const request = createAnalysisGridRequest(selection);

  for (const grid of request.grids) {
    const cell = getCellById(grid.gridId);
    assert.ok(cell);
    assert.deepEqual(grid.southWest, cell.corners[0]);
    assert.deepEqual(grid.northEast, cell.corners[2]);
    assert.deepEqual(Object.keys(grid.southWest).sort(), ["lat", "lng"]);
    assert.deepEqual(Object.keys(grid.northEast).sort(), ["lat", "lng"]);
  }

  const busanGrid = request.grids.find((grid) => grid.gridId === busan.id)!;
  const envelopeSouthWest = {
    lat: Math.min(...busan.corners.map((corner) => corner.lat)),
    lng: Math.min(...busan.corners.map((corner) => corner.lng)),
  };
  const envelopeNorthEast = {
    lat: Math.max(...busan.corners.map((corner) => corner.lat)),
    lng: Math.max(...busan.corners.map((corner) => corner.lng)),
  };
  // A projected square is slightly rotated in geographic coordinates. Its actual
  // opposite vertices must not be replaced by a latitude/longitude envelope.
  assert.notDeepEqual(busanGrid.southWest, envelopeSouthWest);
  assert.notDeepEqual(busanGrid.northEast, envelopeNorthEast);
});

test("duplicate and invalid IDs never add grids or consume candidate labels", () => {
  const north = gridId(0, 1);
  const request = createAnalysisGridRequest(selectionWithGridIds([
    anchor.id, "invalid-grid", north, anchor.id, "5179:100:0:0", "", north,
  ]));

  assert.deepEqual(request.grids.map((grid) => grid.gridId), [north, anchor.id]);
  assert.deepEqual(request.grids.map((grid) => grid.label), ["A", "B"]);
  assert.deepEqual(createAnalysisGridRequest(selectionWithGridIds(["invalid-grid", "5179:100:0:0"])).grids, []);
});

test("all thirty selected grids are serialized, including Z and AA through AD", () => {
  const ids = Array.from({ length: 30 }, (_, index) => gridId(index % 6, Math.floor(index / 6)));
  const selection = selectionWithGridIds(ids);
  const request = createAnalysisGridRequest(selection);

  assert.equal(request.grids.length, 30);
  assert.equal(new Set(request.grids.map((grid) => grid.gridId)).size, 30);
  assert.deepEqual(request.grids.map(({ gridId: id, label }) => ({ gridId: id, label })), createGridCandidates(selection).map(({ gridId: id, label }) => ({ gridId: id, label })));
  assert.deepEqual(request.grids.slice(25).map((grid) => grid.label), ["Z", "AA", "AB", "AC", "AD"]);
});

test("building and editing a request never mutates the selection or another request snapshot", () => {
  const selection = Object.freeze({
    ...exampleSelection(),
    gridIds: Object.freeze([gridId(1, 0), gridId(0, 1), anchor.id]),
  });
  const originalSelection = structuredClone(selection);
  const first = createAnalysisGridRequest(selection);
  const second = createAnalysisGridRequest(selection);
  const originalRequest = structuredClone(second);

  assert.deepEqual(selection, originalSelection);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.grids, second.grids);
  for (let index = 0; index < first.grids.length; index += 1) {
    assert.notStrictEqual(first.grids[index], second.grids[index]);
    assert.notStrictEqual(first.grids[index].southWest, second.grids[index].southWest);
    assert.notStrictEqual(first.grids[index].northEast, second.grids[index].northEast);
    assert.notStrictEqual(first.grids[index].southWest, first.grids[index].northEast);
  }

  first.grids[0].southWest.lat = 0;
  first.grids[0].northEast.lng = 0;
  first.grids[0].label = "changed request";
  first.grids.pop();

  assert.deepEqual(selection, originalSelection);
  assert.deepEqual(second, originalRequest);
  assert.deepEqual(createAnalysisGridRequest(selection), originalRequest);
});
