"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DemoReport } from "@/types/demo";
import styles from "./ResultView.module.css";

interface ResultViewProps {
  report: DemoReport;
  onMap: () => void;
  onHistory: () => void;
  initialAction?: "print" | "email" | null;
  onActionHandled?: () => void;
}

function barWidth(value: number) {
  return `${Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))}%`;
}

function reportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul",
  }).format(date);
}

export default function ResultView({ report, onMap, onHistory, initialAction, onActionHandled }: ResultViewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const dialogTitleId = useId();
  useEffect(() => {
    if (initialAction === "email") {
      dialogRef.current?.showModal(); onActionHandled?.();
    } else if (initialAction === "print") {
      const timer = window.setTimeout(() => { window.print(); onActionHandled?.(); }, 200);
      return () => window.clearTimeout(timer);
    }
  }, [initialAction, onActionHandled]);
  const region = report.selection.breadcrumbs.at(-1) || report.selection.address || report.name;
  const recommended = report.candidates.find((candidate) => candidate.id === report.recommendedCandidateId)
    ?? [...report.candidates].sort((a, b) => b.score - a.score)[0];
  const rating = report.score >= 80 ? "좋음" : report.score >= 60 ? "보통" : "검토 필요";
  const suitabilityDescription = report.score >= 80
    ? "입점 검토에 적합한 상권입니다."
    : report.score >= 60 ? "입점 조건을 함께 검토해보세요." : "입점 조건을 신중하게 검토해보세요.";
  const emailText = [
    `[노른자] ${region} 입지 분석 결과`,
    "",
    "가상 데이터로 생성된 데모 리포트입니다.",
    `분석일: ${reportDate(report.createdAt)}`,
    `입점 적합도: ${report.score} / 100 (${rating})`,
    "",
    ...report.metrics.map((metric) => `${metric.label}: ${metric.value}점`),
    "",
    "후보 점포 비교",
    ...report.candidates.map((candidate) => `${candidate.label} · ${candidate.address} · ${candidate.score}점`),
    "",
    recommended ? `추천 후보 ${recommended.label} · ${recommended.address} (${recommended.score}점)` : "등록된 후보 점포가 없습니다.",
  ].join("\n");

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(emailText);
      setCopyStatus("메일 본문을 복사했어요.");
    } catch {
      setCopyStatus("본문을 선택해서 복사해주세요.");
    }
  }

  return (
    <main className={styles.main} aria-labelledby="result-title" data-result-report>
      <header className={styles.topbar} data-no-print>
        <p>노른자 <span>/</span> 입지 분석 결과</p>
        <p>입지전략팀 <span>·</span> Professional</p>
      </header>

      <div className={styles.content}>
        <header className={styles.heading}>
          <h1 id="result-title">{region}, 입점 가능성을 확인해요</h1>
          <p>위성 데이터와 지역 정보를 바탕으로 후보 점포를 비교했어요.</p>
          <p className={styles.printMeta}>노른자 입지 분석 리포트 · {reportDate(report.createdAt)} · 가상 데이터 데모</p>
        </header>

        <section className={styles.overview} aria-label="입지 분석 종합 평가">
          <div className={styles.suitability}>
            <h2>입점 적합도</h2>
            <p className={styles.suitabilityCaption}>위성 데이터 + 지상 데이터 종합 평가</p>
            <div className={styles.gaugeGroup}>
              <div className={styles.gauge} role="img" aria-label={`입점 적합도 ${report.score}점, 100점 만점`}>
                {/* Original gauge asset exported from Figma, at its intrinsic size. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/report-gauge.svg" width={320} height={230} alt="" />
                <p className={styles.score} aria-hidden="true">{report.score}</p>
                <p className={styles.scoreMaximum} aria-hidden="true">/ 100</p>
              </div>
              <span className={`${styles.rating} ${report.score < 80 ? styles.ratingNeutral : ""}`}>{rating}</span>
              <p className={styles.suitabilityDescription}>{suitabilityDescription}</p>
            </div>
          </div>

          <div className={styles.metricsAndCandidates}>
            <h2>주요 평가 지표</h2>
            <div className={styles.metrics}>
              {report.metrics.slice(0, 5).map((metric, index) => (
                <div className={styles.metric} key={`${metric.label}-${index}`}>
                  <div className={styles.metricLabel}><span>{metric.label}</span><strong>{metric.value}</strong></div>
                  <div className={styles.track} role="meter" aria-label={metric.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={metric.value}>
                    <span style={{ width: barWidth(metric.value) }} />
                  </div>
                </div>
              ))}
            </div>

            <section className={styles.candidateSection} aria-labelledby="candidate-comparison-title">
              <h2 id="candidate-comparison-title">후보 점포 비교</h2>
              <div className={styles.candidateComparison}>
                {report.candidates.map((candidate) => (
                  <div
                    className={`${styles.candidate} ${candidate.id === recommended?.id ? styles.recommendedCandidate : ""}`}
                    key={candidate.id}
                    title={`${candidate.name} · ${candidate.address}`}
                  >
                    <div className={styles.candidateScore}><span>{candidate.label}</span><strong>{candidate.score}</strong></div>
                    <div className={styles.candidateTrack} role="meter" aria-label={`후보 ${candidate.label} 점수`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={candidate.score}>
                      <span style={{ width: barWidth(candidate.score) }} />
                    </div>
                  </div>
                ))}
                {report.candidates.length === 0 && <p className={styles.noCandidates}>등록된 후보 점포가 없어요.</p>}
              </div>
            </section>
          </div>
        </section>

        {recommended && (
          <aside className={styles.insight} aria-label="추천 후보 점포">
            <span className={styles.candidateMarker}>{recommended.label}</span>
            <div>
              <p>추천 후보 {recommended.label} · {recommended.address}</p>
              <p>{recommended.score}점으로 후보 {report.candidates.length}곳 중 가장 높은 점수를 받았어요.</p>
            </div>
          </aside>
        )}

        <section className={styles.printCandidates} aria-label="후보 점포 상세 목록">
          <h2>후보 점포 상세</h2>
          <table>
            <thead><tr><th scope="col">후보</th><th scope="col">점포명 · 주소</th><th scope="col">층 · 면적</th><th scope="col">점수</th></tr></thead>
            <tbody>
              {report.candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <th scope="row">{candidate.label}{candidate.id === recommended?.id ? " (추천)" : ""}</th>
                  <td>{candidate.name}<br />{candidate.address}</td>
                  <td>{candidate.floor}층 · {candidate.areaPyeong}평</td>
                  <td>{candidate.score}점</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className={styles.actions} data-no-print>
          <button className={styles.pdfButton} type="button" onClick={() => window.print()} title="인쇄 창에서 ‘PDF로 저장’을 선택해주세요.">PDF 다운로드</button>
          <button className={styles.mailButton} type="button" onClick={() => { setCopyStatus(""); dialogRef.current?.showModal(); }} title="데모 메일 미리보기 · 실제 발송 없음">메일 발송</button>
          <span className={styles.actionSpacer} />
          <button className={styles.mapButton} type="button" onClick={onMap}>지도에서 보기</button>
          <button className={styles.detailButton} type="button" onClick={onMap}>분석 지도 자세히 보기 <span aria-hidden="true">→</span></button>
        </div>

        <footer className={styles.footnote}>
          <p>가상 데이터로 생성된 데모 리포트입니다.<span data-no-print> PDF는 인쇄 창에서 저장할 수 있어요.</span></p>
          <button type="button" onClick={onHistory} data-no-print>분석내역 보기 <span aria-hidden="true">→</span></button>
        </footer>
      </div>

      <dialog ref={dialogRef} className={styles.emailDialog} aria-labelledby={dialogTitleId} data-no-print>
        <div className={styles.dialogHeading}>
          <div><span className={styles.demoBadge}>데모</span><h2 id={dialogTitleId}>메일 미리보기</h2></div>
          <button type="button" className={styles.closeButton} onClick={() => dialogRef.current?.close()} aria-label="미리보기 닫기">×</button>
        </div>
        <p className={styles.dialogDescription}>실제 메일이 발송되지 않아요. 아래에서 리포트 내용을 확인할 수 있어요.</p>
        <div className={styles.emailPreview}><pre>{emailText}</pre></div>
        <p className={styles.copyStatus} role="status">{copyStatus}</p>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.mapButton} onClick={() => dialogRef.current?.close()}>닫기</button>
          <button type="button" className={styles.detailButton} onClick={() => void copyEmail()}>본문 복사</button>
        </div>
      </dialog>
    </main>
  );
}
