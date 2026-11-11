import { getCellAtPoint, getCellById, GRID_SIZE_METERS } from "./grid";
import { createMockSelection } from "./mock-analysis";
import type { AnalysisSelection } from "../types/analysis";
import type { AddonId, DemoCandidate, DemoReport, DemoSettings } from "../types/demo";

export const ADDON_PRICES: Record<AddonId, number> = { competitor: 10_000, night: 10_000, accessibility: 10_000, candidateComparison: 20_000 };
export const DEFAULT_SETTINGS: DemoSettings = {
  purpose: "신규 입점", industry: "CU 편의점", targetMonthlySales: "50,000,000원 이상", storeType: "일반 로드샵",
  targetCustomers: ["직장인", "20대", "30대"], notes: "20~30대 직장인과 야간 유동인구를 중심으로 분석해주세요.", addons: ["competitor", "candidateComparison"],
};
export function addonTotal(addons: readonly AddonId[]) {
  return [...new Set(addons)].reduce((sum, id) => sum + (ADDON_PRICES[id] ?? 0), 0);
}

export function exampleSelection(lat = 36.3518, lng = 127.3874, name = "대전 서구 둔산동"): AnalysisSelection {
  const cell = getCellAtPoint({ lat, lng });
  const ids = [cell.id, `5179:100:${cell.column + 1}:${cell.row}`, `5179:100:${cell.column}:${cell.row + 1}`, `5179:100:${cell.column + 1}:${cell.row + 1}`];
  return createMockSelection(ids, { name, breadcrumbs: ["대전광역시", "서구", "둔산동"] })!;
}

export function selectionCenter(selection: AnalysisSelection) {
  const points = selection.gridIds.map(getCellById).filter((cell) => cell !== null).map((cell) => cell.center);
  if (!points.length) return { lat: 36.3518, lng: 127.3874 };
  return { lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length, lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length };
}

export function candidateLabel(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError("Candidate index must be a nonnegative integer.");
  let label = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + (value - 1) % 26) + label;
  }
  return label;
}

/** One selected cell is one candidate, ordered north-to-south and west-to-east. */
export function createGridCandidates(selection: AnalysisSelection): DemoCandidate[] {
  const cells = [...new Set(selection.gridIds)].map(getCellById).filter(cell => cell !== null)
    .sort((a, b) => b.row - a.row || a.column - b.column);
  return cells.map((cell, index) => ({
    id: `candidate:${cell.id}`, gridId: cell.id, label: candidateLabel(index),
    areaSquareMeters: GRID_SIZE_METERS ** 2, score: [78, 84, 87, 80, 76][index % 5],
  }));
}

export function createDemoReport(selection: AnalysisSelection, candidates: DemoCandidate[], settings: DemoSettings, now = new Date()): DemoReport {
  const recommended = [...candidates].sort((a, b) => b.score - a.score)[0];
  return {
    id: `report-${now.getTime()}`, name: `${(selection.address ?? "선택한 지역").replace(/ 인근$/, "")} 분석`,
    selection: structuredClone(selection), candidates: structuredClone(candidates), settings: structuredClone(settings), createdAt: now.toISOString(),
    status: "processing", score: 82, recommendedCandidateId: recommended?.id ?? "",
    metrics: [{ label: "유동인구 수요", value: 87 }, { label: "주거 배후 수요", value: 91 }, { label: "경쟁 환경", value: 72 }, { label: "위성 활력 지표", value: 84 }, { label: "접근성", value: 79 }],
  };
}

export function exampleHistory(): DemoReport[] {
  return [
    { name: "둔산동 A 영역", lat: 36.3518, lng: 127.3874, score: 82, status: "completed" as const },
    { name: "보라매공원 인근", lat: 36.3555, lng: 127.3908, score: 75, status: "completed" as const },
    { name: "샘머리공원 인근", lat: 36.3471, lng: 127.3922, score: 88, status: "completed" as const },
    { name: "시청역 남측 영역", lat: 36.3480, lng: 127.3822, score: 0, status: "processing" as const },
    { name: "탄방동 후보 영역", lat: 36.3448, lng: 127.3855, score: 0, status: "candidate" as const },
  ].map((area, index) => {
    const selection = exampleSelection(area.lat, area.lng);
    const report = createDemoReport(selection, createGridCandidates(selection), DEFAULT_SETTINGS, new Date(`2026-11-${String(10 - index).padStart(2, "0")}T09:00:00+09:00`));
    return { ...report, id: `example-${index}`, name: area.name, score: area.score, status: area.status };
  });
}

export function demoProgress(startedAt: string, now = Date.now()) {
  const elapsed = now - Date.parse(startedAt);
  return Number.isFinite(elapsed) ? Math.min(100, Math.max(0, Math.floor(elapsed / 180))) : 0;
}
