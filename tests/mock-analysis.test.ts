import assert from "node:assert/strict";
import test from "node:test";
import { createMockSelection } from "../src/lib/mock-analysis";

const first = "5179:100:10000:20000";
const second = "5179:100:10001:20000";
const region = { name: "대전 서구 둔산동", breadcrumbs: ["대전광역시", "서구", "둔산동"] };

test("empty and invalid selections preserve the empty analysis state", () => {
  assert.equal(createMockSelection([], null), null);
  assert.equal(createMockSelection(["invalid", "5179:100:0:0"], region), null);
});

test("duplicates and selection order cannot alter statistics or area", () => {
  const expected = createMockSelection([first, second], region);
  assert.deepEqual(createMockSelection([second, first, first, "invalid"], region), expected);
  assert.equal(expected?.areaSquareMeters, 20_000);
  assert.equal(expected?.address, region.name);
  assert.deepEqual(expected?.breadcrumbs, region.breadcrumbs);
});

test("all population and store totals equal the sum of their cells", () => {
  const a = createMockSelection([first], null)!;
  const b = createMockSelection([second], null)!;
  const both = createMockSelection([first, second], null)!;
  for (const key of ["residentPopulation", "floatingPopulation", "cuStoreCount", "competingStoreCount"] as const) {
    assert.equal(both.statistics[key], a.statistics[key]! + b.statistics[key]!);
  }
  assert.equal(both.areaSquareMeters, a.areaSquareMeters! + b.areaSquareMeters!);
  assert.equal(a.address, "선택한 그리드");
  assert.deepEqual(a.breadcrumbs, []);
});

test("sample data remains in the intended per-cell ranges and is immutable to callers", () => {
  for (let column = 10_000; column < 10_100; column += 1) {
    const selection = createMockSelection([`5179:100:${column}:20000`], region)!;
    const stats = selection.statistics;
    assert.ok(stats.residentPopulation! >= 40 && stats.residentPopulation! <= 350);
    assert.ok(stats.floatingPopulation! >= 200 && stats.floatingPopulation! <= 1500);
    assert.ok(stats.cuStoreCount === 0 || stats.cuStoreCount === 1);
    assert.ok(stats.competingStoreCount! >= 0 && stats.competingStoreCount! <= 2);
  }
  const selection = createMockSelection([first], region)!;
  region.breadcrumbs.push("temporary");
  assert.deepEqual(selection.breadcrumbs, ["대전광역시", "서구", "둔산동"]);
  region.breadcrumbs.pop();
});
