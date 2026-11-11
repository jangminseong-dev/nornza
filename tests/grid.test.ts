import assert from "node:assert/strict";
import test from "node:test";
import { getCellAtPoint, getCellById, getVisibleCells, GRID_SIZE_METERS } from "../src/lib/grid";

test("EPSG:5179 natural origin has its documented false easting/northing", () => {
  // 127.5 E / 38 N -> easting 1,000,000 m, northing 2,000,000 m.
  const cell = getCellAtPoint({ lat: 38, lng: 127.5 });
  assert.equal(GRID_SIZE_METERS, 100);
  assert.equal(cell.id, "5179:100:10000:20000");
  assert.ok(Math.abs(cell.corners[0].lat - 38) < 1e-8);
  assert.ok(Math.abs(cell.corners[0].lng - 127.5) < 1e-8);
  assert.equal(getCellAtPoint(cell.corners[0]).id, cell.id);
});

test("centers round trip across Korean locations without changing their IDs", () => {
  for (const point of [
    { lat: 36.3504, lng: 127.3845 },
    { lat: 37.5665, lng: 126.978 },
    { lat: 33.4996, lng: 126.5312 },
    { lat: 37.241, lng: 131.865 },
  ]) {
    const cell = getCellAtPoint(point);
    assert.equal(getCellAtPoint(cell.center).id, cell.id);
    assert.deepEqual(getCellById(cell.id), cell);
    assert.equal(cell.corners.length, 4);
  }
});

test("an exact edge is stable while points on either side select adjacent cells", () => {
  const edge = getCellAtPoint({ lat: 38, lng: 127.5 });
  const west = getCellAtPoint({ lat: 38, lng: 127.5 - 1e-8 });
  const east = getCellAtPoint({ lat: 38, lng: 127.5 + 1e-8 });
  const south = getCellAtPoint({ lat: 38 - 1e-8, lng: 127.5 });
  assert.equal(west.column, edge.column - 1);
  assert.equal(east.column, edge.column);
  assert.equal(south.row, edge.row - 1);
});

test("invalid or out-of-area IDs and coordinates are rejected", () => {
  for (const id of [
    "", "5179:50:10000:20000", "5179:100:010000:20000",
    "5179:100:10000:20000:extra", "5179:100:10000.5:20000",
    "5179:100:10000:20000\n",
    "5179:100:-1:20000", "5179:100:0:0", "5179:100:99999999999999999:1",
  ]) assert.equal(getCellById(id), null);

  assert.throws(() => getCellAtPoint({ lat: Number.NaN, lng: 127 }), RangeError);
  assert.throws(() => getCellAtPoint({ lat: 0, lng: 0 }), RangeError);
});

test("visible grids contain the viewport center and have unique stable IDs", () => {
  const bounds = { south: 36.350, west: 127.383, north: 36.352, east: 127.386 };
  const cells = getVisibleCells(bounds);
  assert.ok(cells.length > 0 && cells.length < 1000);
  assert.equal(new Set(cells.map((cell) => cell.id)).size, cells.length);
  const centerId = getCellAtPoint({ lat: 36.351, lng: 127.3845 }).id;
  assert.ok(cells.some((cell) => cell.id === centerId));
  assert.deepEqual(getVisibleCells(bounds), cells);
  assert.deepEqual(getVisibleCells(bounds, cells.length - 1), []);
});

test("oversized, degenerate, nonfinite, and unrelated viewports produce no partial grid", () => {
  assert.deepEqual(getVisibleCells({ south: 33, west: 125, north: 39, east: 131 }), []);
  assert.deepEqual(getVisibleCells({ south: 33, west: 125, north: 39, east: 131 }, Number.MAX_SAFE_INTEGER), []);
  assert.deepEqual(getVisibleCells({ south: 0, west: 0, north: 1, east: 1 }), []);
  assert.deepEqual(getVisibleCells({ south: 36, west: 127, north: 36, east: 128 }), []);
  assert.deepEqual(getVisibleCells({ south: 36, west: Number.NaN, north: 37, east: 128 }), []);
  assert.deepEqual(getVisibleCells({ south: 36, west: 127, north: 37, east: 128 }, Infinity), []);
});
