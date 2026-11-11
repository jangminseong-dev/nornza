import assert from "node:assert/strict";
import test from "node:test";
import { createDemoReport, createGridCandidates, DEFAULT_SETTINGS, exampleSelection } from "../src/lib/demo";
import { getCellById } from "../src/lib/grid";
import { createHistoryGridAnnotations } from "../src/lib/history-map";
import type { DemoReport } from "../src/types/demo";

function completedReport(id = "report-1", createdAt = "2026-11-12T03:00:00.000Z"): DemoReport {
  const selection = exampleSelection();
  return {
    ...createDemoReport(selection, createGridCandidates(selection), DEFAULT_SETTINGS, new Date(createdAt)),
    id,
    status: "completed",
    score: 99,
  };
}

test("analysis history displays one score at each grid center instead of the report's combined score", () => {
  const report = completedReport();
  const annotations = createHistoryGridAnnotations([report], report.id, report.candidates[1].id);

  assert.equal(annotations.length, report.selection.gridIds.length);
  assert.deepEqual(annotations.map(annotation => annotation.label), ["A · 78점", "B · 84점", "C · 87점", "D · 80점"]);
  for (const [index, annotation] of annotations.entries()) {
    const candidate = report.candidates[index];
    assert.deepEqual(annotation.gridIds, [candidate.gridId]);
    assert.deepEqual(annotation.point, getCellById(candidate.gridId)!.center);
    assert.equal(annotation.reportId, report.id);
    assert.equal(annotation.candidateId, candidate.id);
    assert.equal(annotation.variant, "grid-score");
    assert.equal(annotation.tone, "completed");
    assert.equal(annotation.active, index === 1);
    assert.equal(annotation.description, `${report.name} · 후보 그리드 ${candidate.label} · 분석 완료`);
  }
});

test("processing and unsubmitted grids show their statuses without revealing future scores", () => {
  for (const [status, label, tone] of [
    ["processing", "분석 중", "processing"],
    ["candidate", "후보", "prospect"],
  ] as const) {
    const report = { ...completedReport(), status };
    const annotations = createHistoryGridAnnotations([report], report.id, report.candidates[0].id);
    assert.deepEqual(annotations.map(annotation => annotation.label), ["A", "B", "C", "D"].map(letter => `${letter} · ${label}`));
    assert.ok(annotations.every(annotation => annotation.tone === tone));
    assert.ok(annotations.every(annotation => !/\d+점/.test(`${annotation.label} ${annotation.description}`)));
    assert.equal(annotations[0].active, true);
  }
});

test("annotation identities include the report and candidate and round-trip arbitrary separators", () => {
  const report = completedReport('report:["a:b"]');
  report.candidates[0].id = 'candidate:["c:d"]';
  const annotations = createHistoryGridAnnotations([report], report.id, report.candidates[0].id);
  assert.deepEqual(JSON.parse(annotations[0].id), [report.id, report.candidates[0].id]);
  assert.equal(new Set(annotations.map(annotation => annotation.id)).size, annotations.length);
  const otherReport = { ...report, id: "different-report" };
  const other = createHistoryGridAnnotations([otherReport], otherReport.id, report.candidates[0].id);
  assert.notEqual(other[0].id, annotations[0].id);
});

test("a selected older report takes precedence over newer analyses of the same grids", () => {
  const older = completedReport("older", "2026-11-10T03:00:00.000Z");
  const newer = completedReport("newer", "2026-11-12T03:00:00.000Z");
  newer.candidates.forEach(candidate => { candidate.score = 95; });

  for (const reports of [[newer, older], [older, newer]]) {
    const annotations = createHistoryGridAnnotations(reports, older.id, older.candidates[2].id);
    assert.equal(annotations.length, 4);
    assert.ok(annotations.every(annotation => annotation.reportId === older.id));
    assert.equal(annotations[2].label, "C · 87점");
    assert.deepEqual(annotations.filter(annotation => annotation.active).map(annotation => annotation.candidateId), [older.candidates[2].id]);
  }
});

test("overlapping inactive reports use the latest report without hiding their nonoverlapping grids", () => {
  const older = completedReport("older", "2026-11-10T03:00:00.000Z");
  const newer = completedReport("newer", "2026-11-12T03:00:00.000Z");
  newer.candidates = newer.candidates.slice(0, 2);
  newer.candidates.forEach(candidate => { candidate.score = 95; });

  for (const reports of [[older, newer], [newer, older]]) {
    const annotations = createHistoryGridAnnotations(reports, "another-report", older.candidates[0].id);
    assert.equal(annotations.length, 4);
    assert.deepEqual(annotations.map(annotation => annotation.reportId), ["newer", "newer", "older", "older"]);
    assert.deepEqual(annotations.map(annotation => annotation.label), ["A · 95점", "B · 95점", "C · 87점", "D · 80점"]);
    assert.ok(annotations.every(annotation => !annotation.active));
  }
});

test("an active report only claims its own cells and null candidate selection highlights none", () => {
  const active = completedReport("active", "2026-11-10T03:00:00.000Z");
  active.candidates = active.candidates.slice(0, 1);
  const newer = completedReport("newer", "2026-11-12T03:00:00.000Z");
  const annotations = createHistoryGridAnnotations([newer, active], active.id, null);

  assert.equal(annotations.length, 4);
  assert.deepEqual(annotations.map(annotation => annotation.reportId), ["active", "newer", "newer", "newer"]);
  assert.ok(annotations.every(annotation => !annotation.active));
});

test("empty and invalid grid entries are safe and building annotations does not mutate saved reports", () => {
  assert.deepEqual(createHistoryGridAnnotations([], "missing", null), []);
  const report = completedReport();
  report.candidates.push({ ...report.candidates[0], id: "invalid", gridId: "invalid-grid" });
  const before = structuredClone(report);
  const annotations = createHistoryGridAnnotations([report], report.id, null);

  assert.equal(annotations.length, 4);
  annotations[0].point.lat = 0;
  assert.deepEqual(report, before);
  assert.notEqual(createHistoryGridAnnotations([report], report.id, null)[0].point.lat, 0);
});
