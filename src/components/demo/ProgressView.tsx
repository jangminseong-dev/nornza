"use client";

import type { DemoReport } from "@/types/demo";
import styles from "./ProgressView.module.css";

interface ProgressViewProps {
  report: DemoReport;
  progress: number;
  onOpenResult: () => void;
  onOpenMap: () => void;
}

const STAGES = [
  { label: "요청 완료", active: "분석 요청 확인 중", description: "선택한 분석 영역과 후보 점포를 확인하고 있어요." },
  { label: "분석가 접수", active: "분석 조건 확인 중", description: "분석 목적과 요청사항에 맞춰 분석을 준비하고 있어요." },
  { label: "위성데이터 수집", active: "위성데이터 수집 중", description: "위성 데이터와 지역 정보를 모으는 과정을 보여드려요." },
  { label: "종합 분석", active: "종합 분석 중", description: "위성 데이터와 지역 정보를 종합하고 있어요." },
  { label: "리포트 완료", active: "분석 완료", description: "선택한 영역과 후보 점포의 분석 결과가 준비되었어요." },
];
const numberFormatter = new Intl.NumberFormat("ko-KR");
const dateFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date).replace(/\s/g, "").replace(/\.$/, "");
}

export default function ProgressView({ report, progress, onOpenResult, onOpenMap }: ProgressViewProps) {
  const percent = Number.isFinite(progress) ? Math.round(Math.min(100, Math.max(0, progress))) : 0;
  const complete = percent === 100;
  const currentStep = percent < 15 ? 0 : percent < 35 ? 1 : percent < 60 ? 2 : percent < 100 ? 3 : 4;
  const currentStage = STAGES[currentStep];

  return (
    <main className={styles.main} data-demo-view="progress">
      <header className={styles.topbar}>
        <p>노른자 <span aria-hidden="true">/</span> 분석 진행 현황</p>
        <p className={styles.workspaceLabel}><span className={styles.demoBadge}>데모</span>입지전략팀 <span aria-hidden="true">·</span> Professional</p>
      </header>

      <div className={styles.content}>
        <div className={styles.heading}>
          <h1>{complete ? "입지 분석이 완료되었어요" : "입지를 꼼꼼히 분석하고 있어요"}</h1>
          <p>{report.selection.address ?? "선택한 분석 영역"} · 후보 점포 {report.candidates.length}곳</p>
        </div>

        <span className={`${styles.statusBadge} ${complete ? styles.completedBadge : ""}`}>{complete ? "분석 완료" : "분석 진행 중"}</span>

        <ol className={styles.stages} aria-label="분석 진행 단계">
          {STAGES.map((stage, index) => {
            const done = complete || index < currentStep;
            const current = !complete && index === currentStep;
            return (
              <li key={stage.label} className={`${styles.stage} ${done ? styles.stageDone : current ? styles.stageCurrent : styles.stagePending}`} aria-current={current ? "step" : undefined}>
                <span className={styles.stageNumber}>{String(index + 1).padStart(2, "0")}{done && <span className={styles.check} aria-label="완료">✓</span>}</span>
                <span className={styles.stageLabel}>{stage.label}</span>
              </li>
            );
          })}
        </ol>

        <div className={styles.progress}>
          <div className={styles.track} role="progressbar" aria-label="데모 분석 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${currentStage.label}, ${percent}%`}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <div className={styles.progressCaption}><span>분석 진행률</span><span>{percent}%</span></div>
        </div>

        <section className={styles.currentStatus} aria-label="현재 분석 상태">
          <h2>{currentStage.active} · {percent}% 완료</h2>
          <p>{currentStage.description}<br />{complete ? "리포트에서 후보 점포별 결과를 확인해보세요." : "분석이 끝나면 리포트에서 결과를 확인할 수 있어요."}</p>
          <small>데모 진행 · 실제 결제나 분석 요청 없이 예시 결과를 보여드려요.</small>
        </section>

        <dl className={styles.metadata}>
          <div><dt>분석 면적</dt><dd>{report.selection.areaSquareMeters == null ? "—" : `${numberFormatter.format(report.selection.areaSquareMeters)}㎡`}</dd></div>
          <div><dt>후보 점포</dt><dd>{report.candidates.length}개</dd></div>
          <div><dt>요청일</dt><dd>{formatDate(report.createdAt)}</dd></div>
          <div><dt>현재 상태</dt><dd>{complete ? "분석 완료" : "분석 중"}</dd></div>
        </dl>

        <div className={styles.actions}>
          <button type="button" onClick={complete ? onOpenResult : onOpenMap}>{complete ? "분석 결과 보기" : "분석 지도에서 확인"}<span aria-hidden="true">→</span></button>
        </div>
      </div>
    </main>
  );
}
