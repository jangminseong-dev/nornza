import assert from "node:assert/strict";
import test from "node:test";
import {
  addonTotal,
  candidateLabel,
  createDemoReport,
  createGridCandidates,
  DEFAULT_SETTINGS,
  demoProgress,
  exampleSelection,
} from "../src/lib/demo";
import { getCellAtPoint, GRID_SIZE_METERS } from "../src/lib/grid";
import { createMockSelection } from "../src/lib/mock-analysis";
import type { AnalysisSelection } from "../src/types/analysis";
import type { AddonId } from "../src/types/demo";

const anchor = getCellAtPoint({ lat: 36.3518, lng: 127.3874 });

function gridId(columnOffset: number, rowOffset: number) {
  return `5179:100:${anchor.column + columnOffset}:${anchor.row + rowOffset}`;
}

function selectionWithGridIds(gridIds: readonly string[]): AnalysisSelection {
  // Preserve duplicates, invalid entries, and input order for the candidate boundary.
  return { ...exampleSelection(), gridIds };
}

test("add-on price totals charge each selected option once without changing the input", () => {
  const addons: AddonId[] = ["competitor", "night", "competitor", "candidateComparison", "accessibility", "candidateComparison"];
  const before = [...addons];
  assert.equal(addonTotal([]), 0);
  assert.equal(addonTotal(["competitor", "candidateComparison"]), 30_000);
  assert.equal(addonTotal(addons), 50_000);
  assert.equal(addonTotal([...addons].reverse()), 50_000);
  assert.deepEqual(addons, before);
});

test("one selected grid produces exactly one area candidate without point or shop fields", () => {
  const selection = createMockSelection([anchor.id], null)!;
  assert.deepEqual(createGridCandidates(selection), [{
    id: `candidate:${anchor.id}`,
    gridId: anchor.id,
    label: "A",
    areaSquareMeters: GRID_SIZE_METERS ** 2,
    score: 78,
  }]);
});

test("disconnected selected grids stay in one-to-one correspondence with candidates", () => {
  const distant = getCellAtPoint({ lat: 36.366, lng: 127.401 });
  const selection = createMockSelection([anchor.id, distant.id], null)!;
  const candidates = createGridCandidates(selection);

  assert.equal(candidates.length, 2);
  assert.deepEqual(new Set(candidates.map((candidate) => candidate.gridId)), new Set(selection.gridIds));
  assert.deepEqual(new Set(candidates.map((candidate) => candidate.id)), new Set(selection.gridIds.map((id) => `candidate:${id}`)));
  assert.equal(candidates.reduce((total, candidate) => total + candidate.areaSquareMeters, 0), selection.areaSquareMeters);
});

test("more than five selected grids remain available and labels continue beyond Z", () => {
  const ids = Array.from({ length: 30 }, (_, index) => gridId(index % 6, Math.floor(index / 6)));
  const selection = createMockSelection(ids, null)!;
  const candidates = createGridCandidates(selection);

  assert.equal(candidates.length, 30);
  assert.equal(new Set(candidates.map((candidate) => candidate.id)).size, 30);
  assert.equal(candidates[0].label, "A");
  assert.equal(candidates[4].label, "E");
  assert.equal(candidates[5].label, "F");
  assert.equal(candidates[25].label, "Z");
  assert.equal(candidates[26].label, "AA");
  assert.equal(candidates[27].label, "AB");
  assert.equal(candidates[29].label, "AD");
  assert.ok(candidates.every((candidate) => candidate.areaSquareMeters === 10_000));
  assert.deepEqual(candidates.slice(0, 7).map((candidate) => candidate.score), [78, 84, 87, 80, 76, 78, 84]);
});

test("candidate labels cross single, double, and triple-letter boundaries", () => {
  const boundaries: [number, string][] = [[0, "A"], [25, "Z"], [26, "AA"], [51, "AZ"], [52, "BA"], [701, "ZZ"], [702, "AAA"]];
  for (const [index, label] of boundaries) assert.equal(candidateLabel(index), label);
});

test("duplicates and invalid grid IDs do not create additional candidates or mutate input", () => {
  const north = gridId(0, 1);
  const ids = Object.freeze([anchor.id, "invalid-grid", north, anchor.id, "5179:100:0:0", "", north]);
  const selection = selectionWithGridIds(ids);
  const before = structuredClone(selection);
  const candidates = createGridCandidates(selection);

  assert.deepEqual(candidates.map((candidate) => candidate.gridId), [north, anchor.id]);
  assert.deepEqual(candidates.map((candidate) => candidate.label), ["A", "B"]);
  assert.deepEqual(selection, before);
  assert.deepEqual(createGridCandidates(selectionWithGridIds([])), []);
  assert.deepEqual(createGridCandidates(selectionWithGridIds(["invalid-grid", "5179:100:0:0"])), []);
});

test("labels and candidate identity follow north-to-south rows and west-to-east columns, independently of click order", () => {
  const northWest = gridId(0, 1);
  const northEast = gridId(1, 1);
  const southWest = gridId(0, 0);
  const southEast = gridId(1, 0);
  const firstOrder = Object.freeze([southEast, northEast, southWest, northWest]);
  const secondOrder = Object.freeze([northWest, southWest, northEast, southEast]);
  const first = createGridCandidates(selectionWithGridIds(firstOrder));
  const second = createGridCandidates(selectionWithGridIds(secondOrder));

  assert.deepEqual(first.map((candidate) => candidate.gridId), [northWest, northEast, southWest, southEast]);
  assert.deepEqual(first.map((candidate) => candidate.label), ["A", "B", "C", "D"]);
  assert.deepEqual(first, second);
});

test("reports recommend the highest-scoring candidate without sorting or mutating the inputs", () => {
  const selection = exampleSelection();
  const candidates = createGridCandidates(selection);
  candidates[0].score = 72;
  candidates[1].score = 96;
  candidates[2].score = 83;
  const settings = structuredClone(DEFAULT_SETTINGS);
  const inputSnapshot = structuredClone({ selection, candidates, settings });
  const now = new Date("2026-11-12T03:00:00.000Z");
  const report = createDemoReport(selection, candidates, settings, now);

  assert.equal(report.recommendedCandidateId, candidates[1].id);
  assert.deepEqual(report.candidates.map((candidate) => candidate.id), candidates.map((candidate) => candidate.id));
  assert.equal(report.createdAt, now.toISOString());
  assert.equal(report.status, "processing");
  assert.deepEqual({ selection, candidates, settings }, inputSnapshot);

  // A saved report must be an independent snapshot even for nested data.
  report.candidates[0].label = "report-only change";
  report.settings.targetCustomers.push("보고서에서만 변경");
  report.settings.addons.length = 0;
  report.selection.statistics.residentPopulation = -1;
  assert.deepEqual({ selection, candidates, settings }, inputSnapshot);
});

test("demo progress clamps before the start and after completion, reaching 100 at 18 seconds", () => {
  const startedAt = "2026-11-12T03:00:00.000Z";
  const start = Date.parse(startedAt);
  assert.equal(demoProgress(startedAt, start - 60_000), 0);
  assert.equal(demoProgress(startedAt, start), 0);
  assert.equal(demoProgress(startedAt, start + 180), 1);
  assert.equal(demoProgress(startedAt, start + 17_999), 99);
  assert.equal(demoProgress(startedAt, start + 18_000), 100);
  assert.equal(demoProgress(startedAt, start + 86_400_000), 100);
});

test("progress increases monotonically and always returns an integer percentage", () => {
  const startedAt = "2026-11-12T03:00:00.000Z";
  const start = Date.parse(startedAt);
  let previous = 0;
  for (let elapsed = -1_000; elapsed <= 30_000; elapsed += 137) {
    const progress = demoProgress(startedAt, start + elapsed);
    assert.ok(Number.isInteger(progress));
    assert.ok(progress >= previous && progress >= 0 && progress <= 100);
    previous = progress;
  }
});

test("invalid timestamps and nonfinite clocks do not produce an invalid progress value", () => {
  assert.equal(demoProgress("invalid-date"), 0);
  assert.equal(demoProgress("2026-11-12T03:00:00.000Z", Number.NaN), 0);
  assert.equal(demoProgress("2026-11-12T03:00:00.000Z", Number.POSITIVE_INFINITY), 0);
});
