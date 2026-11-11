"use client";

import type { AnalysisSelection } from "@/types/analysis";
import type { DemoCandidate } from "@/types/demo";
import { GRID_SIZE_METERS } from "@/lib/grid";
import styles from "./CandidatesPanel.module.css";

interface CandidatesPanelProps {
  selection: AnalysisSelection;
  candidates: DemoCandidate[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const numberFormatter = new Intl.NumberFormat("ko-KR");

export default function CandidatesPanel({
  selection, candidates, activeId, onSelect, onBack, onNext,
}: CandidatesPanelProps) {
  const area = selection.areaSquareMeters === null ? "—" : numberFormatter.format(selection.areaSquareMeters);

  return (
    <aside className={styles.panel} aria-labelledby="candidates-title">
      <div className={styles.scroll}>
        <h1 className={styles.heading} id="candidates-title">후보 그리드를 비교해요</h1>
        <button className={`${styles.description} ${styles.areaButton}`} type="button" onClick={onBack} title="그리드 다시 선택">
          {selection.address ?? "선택한 영역"} ({area}㎡)
        </button>

        <div className={styles.count}><span>선택된 후보 그리드</span><strong>{numberFormatter.format(candidates.length)}개</strong></div>
        <ul className={styles.list} aria-label="후보 그리드 목록">
          {candidates.map((candidate) => (
            <li key={candidate.id} className={styles.candidate}>
              <button
                className={`${styles.candidateButton} ${activeId === candidate.id ? styles.candidateSelected : ""}`}
                type="button"
                onClick={() => onSelect(candidate.id)}
                aria-pressed={activeId === candidate.id}
                aria-label={`후보 그리드 ${candidate.label}, ${numberFormatter.format(candidate.areaSquareMeters)}제곱미터, 지도에서 보기`}
              >
                <span className={styles.badge}>{candidate.label}</span>
                <span className={styles.candidateInfo}>
                  <span className={styles.candidateName}>후보 그리드 {candidate.label}</span>
                  <span className={styles.details}>
                    {GRID_SIZE_METERS}m × {GRID_SIZE_METERS}m · {numberFormatter.format(candidate.areaSquareMeters)}㎡
                  </span>
                </span>
              </button>
            </li>
          ))}
          {candidates.length === 0 && <li className={styles.empty}>비교할 그리드를 지도에서 선택해주세요.</li>}
        </ul>

        <button className={styles.reselectButton} type="button" onClick={onBack}>그리드 다시 선택</button>
        <p className={styles.help}>선택한 그리드마다 후보가 자동으로 생성돼요.<br />다음 단계에서 분석 조건을 설정해요.</p>
      </div>

      <div className={styles.footer}>
        <p className={styles.usageNote}>요청 시 월 제공 분석 1회를 사용해요</p>
        <div className={styles.usageRow}><span>이번 달 사용량</span><strong>3 / 10회 사용</strong></div>
        <div className={styles.progress} role="progressbar" aria-label="이번 달 분석 사용량" aria-valuemin={0} aria-valuemax={10} aria-valuenow={3}>
          <span style={{ width: "30%" }} />
        </div>
        <button className={styles.primary} type="button" onClick={onNext} disabled={candidates.length === 0}>다음: 분석 조건 설정&nbsp; →</button>
      </div>
    </aside>
  );
}
