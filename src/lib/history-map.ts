import { getCellById } from "./grid";
import type { DemoReport } from "../types/demo";
import type { MapAnnotation } from "../types/map";

export interface HistoryGridAnnotation extends MapAnnotation {
  reportId: string;
  candidateId: string;
}

const statusLabels: Record<DemoReport["status"], string> = {
  completed: "분석 완료",
  processing: "분석 중",
  candidate: "후보 지역",
};

/** A visible cell belongs to the active report, or the latest report for that cell. */
export function createHistoryGridAnnotations(
  reports: readonly DemoReport[],
  activeReportId: string,
  activeCandidateId: string | null,
): HistoryGridAnnotation[] {
  const prioritizedReports = [...reports].sort((a, b) => {
    const activePriority = Number(b.id === activeReportId) - Number(a.id === activeReportId);
    if (activePriority) return activePriority;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
  const annotations = new Map<string, HistoryGridAnnotation>();

  for (const report of prioritizedReports) {
    for (const candidate of report.candidates) {
      if (annotations.has(candidate.gridId)) continue;
      const cell = getCellById(candidate.gridId);
      if (!cell) continue;
      const status = statusLabels[report.status];
      annotations.set(candidate.gridId, {
        id: JSON.stringify([report.id, candidate.id]),
        reportId: report.id,
        candidateId: candidate.id,
        point: { ...cell.center },
        label: `${candidate.label} · ${report.status === "completed" ? `${candidate.score}점` : report.status === "processing" ? "분석 중" : "후보"}`,
        description: `${report.name} · 후보 그리드 ${candidate.label} · ${status}`,
        tone: report.status === "completed" ? "completed" : report.status === "processing" ? "processing" : "prospect",
        active: report.id === activeReportId && candidate.id === activeCandidateId,
        variant: "grid-score",
        gridIds: [candidate.gridId],
      });
    }
  }

  return [...annotations.values()];
}
