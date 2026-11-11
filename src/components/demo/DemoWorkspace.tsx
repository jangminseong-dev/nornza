"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AnalysisWorkspace from "@/components/analysis/AnalysisWorkspace";
import GlobalNavigation from "@/components/shared/GlobalNavigation";
import KakaoMap from "@/components/map/KakaoMap";
import CandidatesPanel from "./CandidatesPanel";
import ConditionsView from "./ConditionsView";
import ProgressView from "./ProgressView";
import ResultView from "./ResultView";
import HistoryPanel from "./HistoryPanel";
import AnalysisRequestDebug from "@/components/debug/AnalysisRequestDebug";
import { createAnalysisGridRequest } from "@/lib/analysis-request";
import { createHistoryGridAnnotations } from "@/lib/history-map";
import { DEFAULT_SETTINGS, createDemoReport, createGridCandidates, demoProgress, exampleHistory, exampleSelection, selectionCenter } from "@/lib/demo";
import { getCellById } from "@/lib/grid";
import type { AnalysisSelection } from "@/types/analysis";
import type { AnalysisGridRequest } from "@/types/analysis-request";
import type { DemoReport, DemoSettings, DemoStep } from "@/types/demo";
import type { MapAnnotation, MapRegion, MapTarget } from "@/types/map";
import styles from "./DemoWorkspace.module.css";

const STORAGE_KEY = "nornza-demo-v1";
const steps: DemoStep[] = ["select", "candidates", "conditions", "progress", "result", "history"];
const noop = () => {};
function validSelection(value: unknown): value is AnalysisSelection {
  if (!value || typeof value !== "object") return false;
  const data = value as AnalysisSelection;
  return Array.isArray(data.gridIds) && data.gridIds.length > 0 && data.gridIds.length <= 1000 && data.gridIds.every(id => typeof id === "string" && getCellById(id)) && typeof data.address === "string" && Array.isArray(data.breadcrumbs) && !!data.statistics && typeof data.areaSquareMeters === "number";
}
function validSettings(value: unknown): value is DemoSettings {
  if (!value || typeof value !== "object") return false;
  const data = value as DemoSettings;
  return [data.purpose, data.industry, data.targetMonthlySales, data.storeType, data.notes].every(item => typeof item === "string") && Array.isArray(data.addons) && Array.isArray(data.targetCustomers);
}
function restoreReport(value: unknown): DemoReport | null {
  if (!value || typeof value !== "object") return null;
  const report = value as DemoReport;
  if (!(typeof report.id === "string" && typeof report.name === "string" && validSelection(report.selection) && validSettings(report.settings) && Number.isFinite(Date.parse(report.createdAt)) && Number.isFinite(report.score) && ["completed", "processing", "candidate"].includes(report.status) && Array.isArray(report.metrics) && report.metrics.every(m => m && typeof m.label === "string" && Number.isFinite(m.value)))) return null;
  // Rebuild the grid-derived candidates, including reports saved by the point-based demo.
  const candidates = createGridCandidates(report.selection);
  const recommended = [...candidates].sort((a, b) => b.score - a.score)[0];
  return { ...report, candidates, recommendedCandidateId: recommended?.id ?? "" };
}

export default function DemoWorkspace() {
  const [step, setStep] = useState<DemoStep>("select");
  const [selection, setSelection] = useState<AnalysisSelection | null>(null);
  const [draftSelection, setDraftSelection] = useState<AnalysisSelection | null>(null);
  const [lastGridRequest, setLastGridRequest] = useState<AnalysisGridRequest | null>(null);
  const candidates = useMemo(() => selection ? createGridCandidates(selection) : [], [selection]);
  const [settings, setSettings] = useState<DemoSettings>(() => structuredClone(DEFAULT_SETTINGS));
  const [reports, setReports] = useState<DemoReport[]>(exampleHistory);
  const [activeReportId, setActiveReportId] = useState("example-0");
  const [historyGrid, setHistoryGrid] = useState<{ reportId: string; candidateId: string } | null>(null);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const focusedCandidateId = candidates.some(candidate => candidate.id === activeCandidateId) ? activeCandidateId : candidates[0]?.id ?? null;
  const [startedReportId, setStartedReportId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(0);
  const [region, setRegion] = useState<MapRegion | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapTarget | null>(null);
  const [notice, setNotice] = useState("");
  const [resultAction, setResultAction] = useState<"print" | "email" | null>(null);
  const clearResultAction = useCallback(() => setResultAction(null), []);
  const activeReport = reports.find(report => report.id === activeReportId) ?? reports[0];
  const activeHistoryCandidate = activeReport.candidates.find(candidate => historyGrid?.reportId === activeReport.id && candidate.id === historyGrid.candidateId) ?? activeReport.candidates[0] ?? null;
  const currentReport = activeReport;
  const progress = currentReport.status === "completed" ? 100 : demoProgress(currentReport.createdAt, now);
  const debugSelection = step === "select" ? draftSelection : step === "candidates" || step === "conditions" ? selection : activeReport.selection;
  const gridRequestPreview = useMemo(() => createAnalysisGridRequest(debugSelection), [debugSelection]);

  useEffect(() => {
    let restoredSelection = false;
    let availableReports = reports;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (validSelection(saved.selection)) { setSelection(saved.selection); restoredSelection = true; }
        if (validSettings(saved.settings)) setSettings(saved.settings);
        if (Array.isArray(saved.reports)) {
          const restored = saved.reports.slice(0, 20).map(restoreReport).filter((report: DemoReport | null): report is DemoReport => report !== null);
          if (restored.length) { availableReports = restored; setReports(restored); }
        }
        if (typeof saved.activeReportId === "string") setActiveReportId(saved.activeReportId);
        if (saved.historyGrid && typeof saved.historyGrid.reportId === "string" && typeof saved.historyGrid.candidateId === "string") setHistoryGrid(saved.historyGrid);
        if (typeof saved.startedReportId === "string") setStartedReportId(saved.startedReportId);
      }
    } catch { /* An unavailable or outdated local demo session starts cleanly. */ }
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("step") as DemoStep;
    const reportId = params.get("report");
    if (reportId && availableReports.some(report => report.id === reportId)) setActiveReportId(reportId);
    if (steps.includes(requested) && (restoredSelection || requested === "history" || requested === "result" || (requested === "progress" && availableReports.some(report => report.id === reportId)))) setStep(requested);
    setNow(Date.now());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ selection, settings, reports, activeReportId, historyGrid, startedReportId })); } catch { /* Demo remains usable when browser storage is unavailable. */ }
  }, [hydrated, selection, settings, reports, activeReportId, historyGrid, startedReportId]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("step") as DemoStep;
      const reportId = params.get("report");
      if (reportId && reports.some(report => report.id === reportId)) setActiveReportId(reportId);
      setStep(steps.includes(requested) && (selection || requested === "history" || requested === "result" || (requested === "progress" && reports.some(report => report.id === reportId))) ? requested : "select");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [selection, reports]);

  useEffect(() => {
    if (!reports.some(report => report.status === "processing" && !report.id.startsWith("example-"))) return;
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time);
      if (reports.some(report => report.status === "processing" && !report.id.startsWith("example-") && demoProgress(report.createdAt, time) === 100)) {
        setReports(previous => previous.map(report => report.status === "processing" && !report.id.startsWith("example-") && demoProgress(report.createdAt, time) === 100 ? { ...report, status: "completed" } : report));
      }
    }, 180);
    return () => window.clearInterval(timer);
  }, [reports]);

  useEffect(() => {
    if (!hydrated) return;
    if (step === "candidates" && selection) {
      setFocusTarget(previous => ({ ...selectionCenter(selection), requestId: (previous?.requestId ?? 0) + 1, label: selection.address ?? "선택 영역", level: selection.gridIds.length <= 4 ? 2 : 3 }));
    } else if (step === "history") {
      const cell = activeHistoryCandidate ? getCellById(activeHistoryCandidate.gridId) : null;
      setFocusTarget(previous => ({ ...(cell?.center ?? selectionCenter(activeReport.selection)), requestId: (previous?.requestId ?? 0) + 1, label: activeReport.name, level: 2 }));
    }
  }, [step, selection, activeReportId, activeHistoryCandidate?.gridId, hydrated]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const navigate = useCallback((next: DemoStep, reportId?: string) => {
    setStep(next);
    window.history.pushState(null, "", next === "select" ? "/analysis" : `/analysis?${new URLSearchParams({ step: next, ...(["result", "progress", "history"].includes(next) ? { report: reportId ?? activeReportId } : {}) })}`);
  }, [activeReportId]);

  function focusSelection(area: AnalysisSelection, level = 3) {
    setFocusTarget(previous => ({ ...selectionCenter(area), requestId: (previous?.requestId ?? 0) + 1, label: area.address ?? "선택 영역", level }));
  }
  function startCandidates(area: AnalysisSelection) {
    setSelection(area);
    setActiveCandidateId(createGridCandidates(area)[0]?.id ?? null);
    focusSelection(area); navigate("candidates");
  }
  function selectCandidate(id: string) {
    setActiveCandidateId(id);
    const candidate = candidates.find(item => item.id === id);
    const cell = candidate ? getCellById(candidate.gridId) : null;
    if (candidate && cell) setFocusTarget(previous => ({ ...cell.center, label: `후보 그리드 ${candidate.label}`, requestId: (previous?.requestId ?? 0) + 1, level: 2 }));
  }
  function submitAnalysis() {
    if (!selection || !candidates.length) return;
    // This is the coordinate body to pass to the analysis API once its endpoint is available.
    // Keep the demo request snapshot independent of subsequent selection changes.
    setLastGridRequest(createAnalysisGridRequest(selection));
    const report = createDemoReport(selection, candidates, settings);
    setReports(previous => [report, ...previous].slice(0, 20));
    setActiveReportId(report.id); setStartedReportId(report.id); setNow(Date.now()); navigate("progress", report.id);
  }
  function openHistory(report = activeReport) {
    setActiveReportId(report.id); navigate("history", report.id);
  }
  function openResult(report = activeReport) {
    if (report.status !== "completed") {
      if (!report.id.startsWith("example-") && report.status === "processing") { setActiveReportId(report.id); navigate("progress", report.id); }
      else setNotice("아직 리포트가 준비되지 않은 예시 영역이에요. 분석 완료 영역을 선택해주세요.");
      return;
    }
    setActiveReportId(report.id); navigate("result", report.id);
  }
  function selectHistoryReport(id: string, candidateId?: string) {
    const report = reports.find(item => item.id === id);
    if (!report) return;
    const candidate = report.candidates.find(item => item.id === candidateId) ?? report.candidates[0];
    const cell = candidate ? getCellById(candidate.gridId) : null;
    setActiveReportId(id);
    setHistoryGrid(candidate ? { reportId: id, candidateId: candidate.id } : null);
    if (cell) setFocusTarget(previous => ({ ...cell.center, requestId: (previous?.requestId ?? 0) + 1, label: `후보 그리드 ${candidate.label}`, level: 2 }));
    window.history.replaceState(null, "", `/analysis?${new URLSearchParams({ step: "history", report: id })}`);
  }
  const historyAnnotations = useMemo(() => createHistoryGridAnnotations(reports, activeReport.id, activeHistoryCandidate?.id ?? null), [reports, activeReport.id, activeHistoryCandidate?.id]);
  const annotations = useMemo<MapAnnotation[]>(() => step === "candidates" ? candidates.map(candidate => ({
    id: candidate.id, point: getCellById(candidate.gridId)!.center, label: candidate.label, description: `후보 그리드 ${candidate.label} · ${candidate.areaSquareMeters.toLocaleString("ko-KR")}㎡`, tone: "candidate", active: candidate.id === focusedCandidateId, gridIds: [candidate.gridId],
  })) : historyAnnotations, [step, candidates, focusedCandidateId, historyAnnotations]);
  const mapSelection = step === "candidates" ? selection : activeReport.selection;

  return <div className={styles.workspace} data-print-layout>
    <GlobalNavigation active={step === "result" ? "report" : step === "history" ? "history" : "analysis"}
      onAnalysis={() => navigate("select")}
      onReport={() => openResult(reports.find(report => report.status === "completed") ?? activeReport)}
      onHistory={() => openHistory()} />
    {step === "select" && <AnalysisWorkspace key={hydrated ? "ready" : "initial"} hideNavigation initialSelection={selection} onContinue={startCandidates} onDemoStart={() => startCandidates(exampleSelection())} onSelectionChange={setDraftSelection} />}
    {step === "conditions" && selection && <ConditionsView selection={selection} candidates={candidates} settings={settings} onChange={setSettings} onBack={() => navigate("candidates")} onSubmit={submitAnalysis} />}
    {step === "progress" && <ProgressView report={currentReport} progress={progress} onOpenResult={() => openResult(currentReport)} onOpenMap={() => openHistory(currentReport)} />}
    {step === "result" && (activeReport.status === "completed" ? <ResultView report={activeReport} onMap={() => openHistory(activeReport)} onHistory={() => openHistory(activeReport)} initialAction={resultAction} onActionHandled={clearResultAction} /> : <ProgressView report={activeReport} progress={progress} onOpenResult={() => openResult(activeReport)} onOpenMap={() => openHistory(activeReport)} />)}
    {(step === "candidates" || step === "history") && <>
      {step === "candidates" && selection ? <CandidatesPanel selection={selection} candidates={candidates} activeId={focusedCandidateId} onSelect={selectCandidate}
        onBack={() => navigate("select")} onNext={() => { if (candidates.length) navigate("conditions"); }} />
        : <HistoryPanel reports={reports} activeReport={activeReport} activeCandidate={activeHistoryCandidate} onSelectCandidate={id => selectHistoryReport(activeReport.id, id)} onSelectReport={selectHistoryReport} onViewReport={() => openResult()}
          onDownload={() => { setResultAction("print"); openResult(); }}
          onEmail={() => { setResultAction("email"); openResult(); }}
          onNewAnalysis={() => { setSelection(null); navigate("select"); }} />}
      <section className={styles.map} aria-label={step === "candidates" ? "후보 그리드 지도" : "팀 분석 지도"}>
        <KakaoMap selectedIds={[]} onToggleCell={noop} onRegionChange={setRegion} focusTarget={focusTarget} selectionEnabled={false} annotations={annotations}
          onAnnotationClick={id => {
            if (step === "candidates") selectCandidate(id);
            else {
              const annotation = historyAnnotations.find(item => item.id === id);
              if (annotation) selectHistoryReport(annotation.reportId, annotation.candidateId);
            }
          }} />
        <div className={styles.breadcrumb}><span>{(region?.breadcrumbs ?? mapSelection?.breadcrumbs ?? ["대전광역시", "서구", "둔산동"]).join("  /  ")}</span><small>{step === "candidates" ? "선택 영역" : "분석 지도"}</small></div>
        <div className={styles.north}>N ↑</div>
        <div className={styles.guidance}><strong>{step === "candidates" ? `후보 그리드 ${candidates.length}개를 비교해요` : "그리드별 분석 점수를 확인해요"}</strong><p>{step === "candidates" ? "그리드 하나가 후보 하나예요. 셀을 눌러 비교할 영역을 확인해주세요." : "A·B·C 그리드를 누르면 해당 그리드의 점수와 리포트를 볼 수 있어요."}</p></div>
        <div className={styles.demoBadge}>DEMO · 가상 분석 데이터</div>
        <div className={styles.legend}>{step === "candidates" ? <><span className={styles.gold}>▣ 선택한 후보</span><span>□ 후보 그리드</span><span>100m × 100m</span></> : <><span className={styles.gold}>▣ 선택한 그리드</span><span className={styles.green}>● 분석 완료</span><span>○ 분석 중</span><span>◌ 후보 지역</span></>}</div>
      </section>
    </>}
    <AnalysisRequestDebug preview={gridRequestPreview} lastRequest={lastGridRequest} activeLabel={step === "candidates" ? candidates.find(candidate => candidate.id === focusedCandidateId)?.label : step === "history" ? activeHistoryCandidate?.label : null} />
    {notice && <div className={styles.toast} role="status" data-no-print>{notice}<button onClick={() => setNotice("")} aria-label="안내 닫기">×</button></div>}
  </div>;
}
