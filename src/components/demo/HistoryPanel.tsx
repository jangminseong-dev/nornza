"use client";

import { useState } from "react";
import type { DemoReport } from "@/types/demo";
import styles from "./HistoryPanel.module.css";

interface HistoryPanelProps {
  reports: DemoReport[];
  activeReport: DemoReport;
  onSelectReport: (id: string) => void;
  onViewReport: () => void;
  onDownload: () => void;
  onEmail: () => void;
  onNewAnalysis: () => void;
}

const statusLabels: Record<DemoReport["status"], string> = {
  completed: "분석 완료",
  processing: "분석 중",
  candidate: "후보 지역",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));
}

export default function HistoryPanel({
  reports, activeReport, onSelectReport, onViewReport, onDownload, onEmail, onNewAnalysis,
}: HistoryPanelProps) {
  const [filter, setFilter] = useState<DemoReport["status"] | null>(null);
  const completed = activeReport.status === "completed";
  const filteredReports = reports.filter((report) => report.status === filter);

  return (
    <aside className={styles.panel} aria-labelledby="history-title">
      <div className={styles.scroll}>
        <p className={styles.eyebrow}>노른자 / 팀 워크스페이스</p>
        <h1 className={styles.heading} id="history-title">우리 팀의 분석 지도</h1>
        <p className={styles.description}>분석한 지역과 리포트를 한눈에 확인해요.</p>
        <hr className={`${styles.divider} ${styles.headerDivider}`} />

        <section aria-labelledby="active-report-title">
          <h2 className={styles.areaName} id="active-report-title">{activeReport.name}</h2>
          <span className={`${styles.status} ${activeReport.status === "processing" ? styles.statusProcessing : activeReport.status === "candidate" ? styles.statusCandidate : ""}`}>
            {statusLabels[activeReport.status]}
          </span>
          <p className={styles.scoreLabel}>입점 적합도</p>
          <p className={styles.score}>{completed ? activeReport.score : "—"} / 100</p>
          <hr className={`${styles.divider} ${styles.detailsDivider}`} />
          <dl>
            <div className={styles.row}><dt>후보 그리드</dt><dd>{activeReport.candidates.length}개</dd></div>
            <div className={styles.row}><dt>{completed ? "분석 완료일" : "등록일"}</dt><dd>{formatDate(activeReport.createdAt)}</dd></div>
          </dl>
        </section>

        <hr className={`${styles.divider} ${styles.summaryDivider}`} />
        <section aria-labelledby="team-history-title">
          <h2 className={styles.sectionHeading} id="team-history-title">팀의 분석 이력</h2>
          <div className={styles.summary}>
            {(["completed", "processing", "candidate"] as const).map((status) => (
              <button
                className={styles.filter}
                type="button"
                key={status}
                aria-pressed={filter === status}
                aria-expanded={filter === status}
                aria-controls="filtered-history-list"
                onClick={() => setFilter((previous) => previous === status ? null : status)}
              >
                <span>{statusLabels[status]}</span>
                <strong>{reports.filter((report) => report.status === status).length}개 영역</strong>
              </button>
            ))}
          </div>
          {filter && (
            <ul className={styles.reportList} id="filtered-history-list" aria-label={`${statusLabels[filter]} 목록`}>
              {filteredReports.map((report) => (
                <li key={report.id}>
                  <button className={styles.reportItem} type="button" aria-pressed={activeReport.id === report.id} onClick={() => onSelectReport(report.id)}>
                    <span>{report.name}</span>
                    <small>{report.status === "completed" ? `${report.score}점` : formatDate(report.createdAt)}</small>
                  </button>
                </li>
              ))}
              {filteredReports.length === 0 && <li className={styles.empty}>해당하는 분석 이력이 없어요.</li>}
            </ul>
          )}
          <p className={styles.help}>완료된 분석은 지도에 보관돼요.<br />필요할 때 리포트를 다시 열어보세요.</p>
          <button className={styles.newAnalysis} type="button" onClick={onNewAnalysis}>새 영역 분석하기 →</button>
        </section>
      </div>

      <div className={styles.footer}>
        <button className={styles.primary} type="button" onClick={onViewReport} disabled={!completed}>{completed ? "리포트 보기" : activeReport.status === "processing" ? "분석이 진행 중이에요" : "분석 전인 후보 지역이에요"}</button>
        <div className={styles.exports}>
          <button type="button" onClick={onDownload} disabled={!completed}>PDF 다운로드</button>
          <button type="button" onClick={onEmail} disabled={!completed}>메일 발송</button>
        </div>
      </div>
    </aside>
  );
}
