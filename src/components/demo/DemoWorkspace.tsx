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
import { DEFAULT_SETTINGS, createDemoReport, demoProgress, exampleCandidates, exampleHistory, exampleSelection, newCandidate, selectionCenter } from "@/lib/demo";
import { getCellById } from "@/lib/grid";
import type { AnalysisSelection } from "@/types/analysis";
import type { CandidateInput, DemoCandidate, DemoReport, DemoSettings, DemoStep } from "@/types/demo";
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
function validCandidates(value: unknown): value is DemoCandidate[] {
  return Array.isArray(value) && value.length <= 5 && value.every(c => c && typeof c.id === "string" && typeof c.name === "string" && typeof c.address === "string" && typeof c.label === "string" && [c.lat, c.lng, c.score, c.floor, c.areaPyeong].every(Number.isFinite));
}
function validSettings(value: unknown): value is DemoSettings {
  if (!value || typeof value !== "object") return false;
  const data = value as DemoSettings;
  return [data.purpose, data.industry, data.targetMonthlySales, data.storeType, data.notes].every(item => typeof item === "string") && Array.isArray(data.addons) && Array.isArray(data.targetCustomers);
}
function validReport(value: unknown): value is DemoReport {
  if (!value || typeof value !== "object") return false;
  const report = value as DemoReport;
  return typeof report.id === "string" && typeof report.name === "string" && validSelection(report.selection) && validCandidates(report.candidates) && validSettings(report.settings) && Number.isFinite(Date.parse(report.createdAt)) && Number.isFinite(report.score) && ["completed", "processing", "candidate"].includes(report.status) && Array.isArray(report.metrics) && report.metrics.every(m => typeof m.label === "string" && Number.isFinite(m.value));
}

export default function DemoWorkspace() {
  const [step, setStep] = useState<DemoStep>("select");
  const [selection, setSelection] = useState<AnalysisSelection | null>(null);
  const [candidates, setCandidates] = useState<DemoCandidate[]>([]);
  const [settings, setSettings] = useState<DemoSettings>(() => structuredClone(DEFAULT_SETTINGS));
  const [reports, setReports] = useState<DemoReport[]>(exampleHistory);
  const [activeReportId, setActiveReportId] = useState("example-0");
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [startedReportId, setStartedReportId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(0);
  const [region, setRegion] = useState<MapRegion | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapTarget | null>(null);
  const [notice, setNotice] = useState("");
  const [resultAction, setResultAction] = useState<"print" | "email" | null>(null);
  const clearResultAction = useCallback(() => setResultAction(null), []);
  const activeReport = reports.find(report => report.id === activeReportId) ?? reports[0];
  const currentReport = activeReport;
  const progress = currentReport.status === "completed" ? 100 : demoProgress(currentReport.createdAt, now);

  useEffect(() => {
    let restoredSelection = false;
    let availableReports = reports;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (validSelection(saved.selection)) { setSelection(saved.selection); restoredSelection = true; }
        if (validCandidates(saved.candidates)) setCandidates(saved.candidates);
        if (validSettings(saved.settings)) setSettings(saved.settings);
        if (Array.isArray(saved.reports) && saved.reports.length && saved.reports.every(validReport)) { availableReports = saved.reports.slice(0, 20); setReports(availableReports); }
        if (typeof saved.activeReportId === "string") setActiveReportId(saved.activeReportId);
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
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ selection, candidates, settings, reports, activeReportId, startedReportId })); } catch { /* Demo remains usable when browser storage is unavailable. */ }
  }, [hydrated, selection, candidates, settings, reports, activeReportId, startedReportId]);

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
      setFocusTarget(previous => ({ ...selectionCenter(activeReport.selection), requestId: (previous?.requestId ?? 0) + 1, label: activeReport.name, level: 4 }));
    }
  }, [step, selection, activeReportId, hydrated]);

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
    const sameSelection = selection?.gridIds.join("|") === area.gridIds.join("|");
    setSelection(area);
    const nextCandidates = sameSelection && candidates.length ? candidates : exampleCandidates(area);
    setCandidates(nextCandidates); setActiveCandidateId(nextCandidates[0]?.id ?? null);
    focusSelection(area); navigate("candidates");
  }
  function selectCandidate(id: string) {
    setActiveCandidateId(id);
    const candidate = candidates.find(item => item.id === id);
    if (candidate) setFocusTarget(previous => ({ lat: candidate.lat, lng: candidate.lng, label: candidate.name, requestId: (previous?.requestId ?? 0) + 1, level: 2 }));
  }
  function addCandidate(input: CandidateInput) {
    if (!selection || candidates.length >= 5) return;
    const candidate = newCandidate(selection, input, candidates.length, undefined, candidates);
    setCandidates(previous => [...previous, candidate]); setActiveCandidateId(candidate.id);
    setFocusTarget(previous => ({ lat: candidate.lat, lng: candidate.lng, label: candidate.name, requestId: (previous?.requestId ?? 0) + 1, level: 2 }));
  }
  function submitAnalysis() {
    if (!selection || !candidates.length) return;
    const report = createDemoReport(selection, candidates, settings);
    setReports(previous => [report, ...previous].slice(0, 20));
    setActiveReportId(report.id); setStartedReportId(report.id); setNow(Date.now()); navigate("progress", report.id);
  }
  function openHistory(report = activeReport) {
    setActiveReportId(report.id); focusSelection(report.selection, 4); navigate("history", report.id);
  }
  function openResult(report = activeReport) {
    if (report.status !== "completed") {
      if (!report.id.startsWith("example-") && report.status === "processing") { setActiveReportId(report.id); navigate("progress", report.id); }
      else setNotice("아직 리포트가 준비되지 않은 예시 영역이에요. 분석 완료 영역을 선택해주세요.");
      return;
    }
    setActiveReportId(report.id); navigate("result", report.id);
  }
  function selectHistoryReport(id: string) {
    const report = reports.find(item => item.id === id);
    if (!report) return;
    setActiveReportId(id); focusSelection(report.selection, 4);
    window.history.replaceState(null, "", `/analysis?${new URLSearchParams({ step: "history", report: id })}`);
  }
  const annotations = useMemo<MapAnnotation[]>(() => step === "candidates" ? candidates.map(candidate => ({
    id: candidate.id, point: { lat: candidate.lat, lng: candidate.lng }, label: candidate.label, description: `${candidate.name} · ${candidate.areaPyeong}평`, tone: "candidate", active: candidate.id === activeCandidateId,
  })) : reports.map(report => ({
    id: report.id, point: selectionCenter(report.selection), label: report.status === "completed" ? `${report.score}${report.id === activeReportId ? " / 100" : ""}` : report.status === "processing" ? "분석 중" : "후보 지역",
    description: `${report.name} · ${report.status === "completed" ? "분석 완료" : report.status === "processing" ? "분석 중" : "후보 지역"}`,
    tone: report.id === activeReportId ? "selected" : report.status === "completed" ? "completed" : report.status === "processing" ? "processing" : "prospect", active: report.id === activeReportId, gridIds: report.selection.gridIds,
  })), [step, candidates, activeCandidateId, reports, activeReportId]);
  const mapSelection = step === "candidates" ? selection : activeReport.selection;

  return <div className={styles.workspace} data-print-layout>
    <GlobalNavigation active={step === "result" ? "report" : step === "history" ? "history" : "analysis"}
      onAnalysis={() => navigate("select")}
      onReport={() => openResult(reports.find(report => report.status === "completed") ?? activeReport)}
      onHistory={() => openHistory()} />
    {step === "select" && <AnalysisWorkspace key={hydrated ? "ready" : "initial"} hideNavigation initialSelection={selection} onContinue={startCandidates} onDemoStart={() => startCandidates(exampleSelection())} />}
    {step === "conditions" && selection && <ConditionsView selection={selection} candidates={candidates} settings={settings} onChange={setSettings} onBack={() => navigate("candidates")} onSubmit={submitAnalysis} />}
    {step === "progress" && <ProgressView report={currentReport} progress={progress} onOpenResult={() => openResult(currentReport)} onOpenMap={() => openHistory(currentReport)} />}
    {step === "result" && (activeReport.status === "completed" ? <ResultView report={activeReport} onMap={() => openHistory(activeReport)} onHistory={() => openHistory(activeReport)} initialAction={resultAction} onActionHandled={clearResultAction} /> : <ProgressView report={activeReport} progress={progress} onOpenResult={() => openResult(activeReport)} onOpenMap={() => openHistory(activeReport)} />)}
    {(step === "candidates" || step === "history") && <>
      {step === "candidates" && selection ? <CandidatesPanel selection={selection} candidates={candidates} activeId={activeCandidateId} onSelect={selectCandidate} onAdd={addCandidate}
        onUpdate={(id, input) => setCandidates(previous => previous.map(candidate => candidate.id === id ? { ...candidate, ...input } : candidate))}
        onRemove={id => { setCandidates(previous => previous.filter(candidate => candidate.id !== id).map((candidate, index) => ({ ...candidate, label: String.fromCharCode(65 + index) }))); setActiveCandidateId(null); }}
        onBack={() => navigate("select")} onNext={() => { if (candidates.length) navigate("conditions"); }} />
        : <HistoryPanel reports={reports} activeReport={activeReport} onSelectReport={selectHistoryReport} onViewReport={() => openResult()}
          onDownload={() => { setResultAction("print"); openResult(); }}
          onEmail={() => { setResultAction("email"); openResult(); }}
          onNewAnalysis={() => { setSelection(null); setCandidates([]); navigate("select"); }} />}
      <section className={styles.map} aria-label={step === "candidates" ? "후보 점포 지도" : "팀 분석 지도"}>
        <KakaoMap selectedIds={step === "candidates" ? selection?.gridIds ?? [] : []} onToggleCell={noop} onRegionChange={setRegion} focusTarget={focusTarget} selectionEnabled={false} annotations={annotations}
          onAnnotationClick={id => { if (step === "candidates") selectCandidate(id); else selectHistoryReport(id); }} />
        <div className={styles.breadcrumb}><span>{(region?.breadcrumbs ?? mapSelection?.breadcrumbs ?? ["대전광역시", "서구", "둔산동"]).join("  /  ")}</span><small>{step === "candidates" ? "선택 영역" : "분석 지도"}</small></div>
        <div className={styles.north}>N ↑</div>
        <div className={styles.guidance}><strong>{step === "candidates" ? `후보 점포 ${candidates.length}곳을 비교해요` : "분석 결과를 지도에 모았어요"}</strong><p>{step === "candidates" ? `${candidates.map(candidate => candidate.label).join(" · ")} 위치를 확인한 뒤 분석 조건을 설정해주세요.` : "지역을 선택하면 점수와 리포트를 다시 볼 수 있어요."}</p></div>
        <div className={styles.demoBadge}>DEMO · 가상 분석 데이터</div>
        <div className={styles.legend}>{step === "candidates" ? <><span className={styles.green}>● CU 점포</span><span>○ 경쟁 편의점</span><span className={styles.gold}>▱ 선택 영역</span></> : <><span className={styles.gold}>● 선택 영역</span><span className={styles.green}>● 분석 완료</span><span>○ 분석 중</span><span>◌ 후보 지역</span></>}</div>
      </section>
    </>}
    {notice && <div className={styles.toast} role="status" data-no-print>{notice}<button onClick={() => setNotice("")} aria-label="안내 닫기">×</button></div>}
  </div>;
}
