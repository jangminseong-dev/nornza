import assert from "node:assert/strict";
import test from "node:test";
import {
  addonTotal,
  createDemoReport,
  DEFAULT_SETTINGS,
  demoProgress,
  exampleCandidates,
  exampleSelection,
  newCandidate,
} from "../src/lib/demo";
import { getCellAtPoint } from "../src/lib/grid";
import { createMockSelection } from "../src/lib/mock-analysis";
import type { AddonId } from "../src/types/demo";

test("add-on price totals charge each selected option once without changing the input", () => {
  const addons: AddonId[] = ["competitor", "night", "competitor", "candidateComparison", "accessibility", "candidateComparison"];
  const before = [...addons];
  assert.equal(addonTotal([]), 0);
  assert.equal(addonTotal(["competitor", "candidateComparison"]), 30_000);
  assert.equal(addonTotal(addons), 50_000);
  assert.equal(addonTotal([...addons].reverse()), 50_000);
  assert.deepEqual(addons, before);
});

test("example candidate locations remain inside the selected cells", () => {
  const selection = exampleSelection();
  const candidates = exampleCandidates(selection);
  assert.equal(candidates.length, 3);
  assert.equal(new Set(candidates.map((candidate) => candidate.id)).size, 3);
  for (const candidate of candidates) {
    assert.ok(selection.gridIds.includes(getCellAtPoint(candidate).id), `${candidate.label} must be inside a selected cell`);
  }
});

test("one-cell selections keep all five candidate positions inside that cell", () => {
  const cell = getCellAtPoint({ lat: 36.3518, lng: 127.3874 });
  const selection = createMockSelection([cell.id], null)!;
  for (let index = 0; index < 5; index += 1) {
    const candidate = newCandidate(selection, {
      name: `후보 ${index + 1}`, address: "대전 서구 둔산동", floor: 1, areaPyeong: 30,
    }, index, `single-cell-${index}`);
    assert.equal(getCellAtPoint(candidate).id, cell.id);
  }
  for (const candidate of exampleCandidates(selection)) {
    assert.equal(getCellAtPoint(candidate).id, cell.id);
  }
});

test("disconnected selected cells do not put candidates into the unselected space between them", () => {
  const first = getCellAtPoint({ lat: 36.3518, lng: 127.3874 });
  const distant = getCellAtPoint({ lat: 36.366, lng: 127.401 });
  const selection = createMockSelection([first.id, distant.id], null)!;
  for (const candidate of exampleCandidates(selection)) {
    assert.ok(selection.gridIds.includes(getCellAtPoint(candidate).id));
  }
});

test("reports recommend the highest-scoring candidate without sorting or mutating the inputs", () => {
  const selection = exampleSelection();
  const candidates = exampleCandidates(selection);
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
  report.candidates[0].name = "report-only change";
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

test("adding after removing a candidate does not reuse an occupied point", () => {
  const cell = getCellAtPoint({ lat: 36.3518, lng: 127.3874 });
  const selection = createMockSelection([cell.id], null)!;
  const candidates = exampleCandidates(selection).filter(candidate => candidate.label !== "B");
  const input = { name: "새 후보", address: "선택 영역", floor: 1, areaPyeong: 30 };
  const added = newCandidate(selection, input, candidates.length, "new-candidate", candidates);
  assert.ok(candidates.every(candidate => candidate.lat !== added.lat || candidate.lng !== added.lng));
  assert.equal(getCellAtPoint(added).id, cell.id);
  assert.equal(demoProgress("invalid-date"), 0);
});
