import { getCellAtPoint, getCellById } from "./grid";
import { createMockSelection } from "./mock-analysis";
import type { AnalysisSelection } from "../types/analysis";
import type { AddonId, CandidateInput, DemoCandidate, DemoReport, DemoSettings } from "../types/demo";

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

export function newCandidate(selection: AnalysisSelection, input: CandidateInput, index: number, id = `candidate-${Date.now()}-${index}`, occupied: readonly DemoCandidate[] = []): DemoCandidate {
  const cells = selection.gridIds.map(getCellById).filter((cell) => cell !== null);
  // Five distinct positions stay inside a 100m cell, including after remove/add.
  const offsets = [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]];
  const positions = Array.from({ length: 25 }, (_, offset) => {
    const slot = index + offset;
    const center = cells[slot % Math.max(1, cells.length)]?.center ?? selectionCenter(selection);
    const [dy, dx] = offsets[Math.floor(slot / Math.max(1, cells.length)) % offsets.length];
    return { lat: center.lat + dy * 0.00022, lng: center.lng + dx * 0.00028 };
  });
  const point = positions.find(p => occupied.every(c => Math.abs(p.lat - c.lat) + Math.abs(p.lng - c.lng) > 0.00001)) ?? positions[0];
  return { ...input, id, label: String.fromCharCode(65 + index), ...point, score: [78, 84, 87, 80, 76][index % 5] };
}

export function exampleCandidates(selection: AnalysisSelection): DemoCandidate[] {
  const isDunsan = /둔산/.test(selection.address ?? "");
  return [112, 128, 141].map((number, index) => newCandidate(selection, {
    name: isDunsan ? `둔산로 ${number}` : `후보 점포 ${String.fromCharCode(65 + index)}`,
    address: isDunsan ? `대전 서구 둔산로 ${number}` : `${selection.address ?? "선택한 지역"} · 데모 후보 ${index + 1}`,
    floor: 1, areaPyeong: [28, 34, 31][index],
  }, index, `candidate-${index + 1}`));
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
    const report = createDemoReport(selection, exampleCandidates(selection), DEFAULT_SETTINGS, new Date(`2026-11-${String(10 - index).padStart(2, "0")}T09:00:00+09:00`));
    return { ...report, id: `example-${index}`, name: area.name, score: area.score, status: area.status };
  });
}

export function demoProgress(startedAt: string, now = Date.now()) {
  const elapsed = now - Date.parse(startedAt);
  return Number.isFinite(elapsed) ? Math.min(100, Math.max(0, Math.floor(elapsed / 180))) : 0;
}
