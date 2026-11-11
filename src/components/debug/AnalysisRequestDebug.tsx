"use client";

import { useId, useMemo, useState } from "react";
import type { AnalysisGridRequest } from "@/types/analysis-request";
import styles from "./AnalysisRequestDebug.module.css";

interface AnalysisRequestDebugProps {
  preview: AnalysisGridRequest;
  lastRequest: AnalysisGridRequest | null;
  activeLabel?: string | null;
}

type RequestSource = "preview" | "last";
type CopyState = {
  result: "pending" | "success" | "error";
  source: RequestSource;
  json: string;
} | null;

function formatCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(8) : String(value);
}

export default function AnalysisRequestDebug({
  preview,
  lastRequest,
  activeLabel = null,
}: AnalysisRequestDebugProps) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(true);
  const [source, setSource] = useState<RequestSource>("preview");
  const [copyState, setCopyState] = useState<CopyState>(null);
  const request = source === "preview" ? preview : lastRequest;
  // Only the compact coordinate labels are rounded. Copy/export uses the
  // supplied request directly, including the original numeric precision.
  const json = useMemo(() => request === null ? "" : JSON.stringify(request, null, 2), [request]);
  const copyResult = copyState?.json === json && copyState.source === source ? copyState.result : null;

  async function copyJson() {
    if (!request) return;
    const payload = { source, json };
    setCopyState({ ...payload, result: "pending" });
    try {
      await navigator.clipboard.writeText(json);
      setCopyState({ ...payload, result: "success" });
    } catch {
      setCopyState({ ...payload, result: "error" });
    }
  }

  return (
    <aside
      className={`${styles.panel} ${expanded ? "" : styles.collapsed}`}
      aria-label="분석 요청 디버그"
      data-no-print
      data-debug-expanded={expanded}
    >
      <button
        className={styles.toggle}
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        aria-label={expanded ? "분석 요청 디버그 접기" : "분석 요청 디버그 펼치기"}
        aria-expanded={expanded}
        aria-controls={contentId}
        title={expanded ? "디버그 접기" : "디버그 펼치기"}
      >
        <span aria-hidden="true">{expanded ? "›" : "‹"}</span>
      </button>

      {expanded && (
        <div className={styles.content} id={contentId}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>DEVELOPER VIEW</p>
            <h2>분석 요청 디버그</h2>
          </header>

          <div className={styles.sources} role="group" aria-label="표시할 분석 요청">
            <button type="button" aria-pressed={source === "preview"} onClick={() => setSource("preview")}>현재 선택</button>
            <button type="button" aria-pressed={source === "last"} onClick={() => setSource("last")}>최근 데모 요청</button>
          </div>

          <div className={styles.scroll}>
            <div className={styles.demoNote}>
              <span className={styles.demoBadge}>데모</span>
              <p>{source === "preview" ? "선택한 그리드의 요청 미리보기" : "요청 버튼을 누른 시점의 데이터"}<br /><span>실제 API 전송 없음{source === "last" ? " · 새로고침 시 초기화" : ""}</span></p>
            </div>

            <dl className={styles.metadata}>
              <div><dt>좌표계</dt><dd>{request?.crs ?? preview.crs}</dd></div>
              <div><dt>그리드 좌표계</dt><dd>{request?.gridCrs ?? preview.gridCrs}</dd></div>
              <div><dt>격자 크기</dt><dd>{request?.gridSizeMeters ?? preview.gridSizeMeters}m × {request?.gridSizeMeters ?? preview.gridSizeMeters}m</dd></div>
            </dl>

            <p className={styles.explanation}>
              투영 격자의 실제 남서·북동 꼭지점을 경위도로 변환한 값입니다. 원래 격자는 <code>gridCrs</code>와 <code>gridId</code>로 복원합니다. 경위도 축 기준 bbox와 구분해주세요.
            </p>

            <div className={styles.sectionHeader}>
              <h3>후보 그리드 <span>{request?.grids.length ?? 0}개</span></h3>
              <button className={styles.copyButton} type="button" onClick={copyJson} disabled={!request || copyResult === "pending"}>
                {copyResult === "pending" ? "복사 중…" : copyResult === "success" ? "복사 완료 ✓" : "JSON 복사"}
              </button>
            </div>

            <p className={`${styles.copyStatus} ${copyResult === "error" ? styles.copyError : ""}`} role="status" aria-live="polite">
              {copyResult === "success" ? "전체 JSON을 원본 정밀도로 복사했어요." : copyResult === "error" ? "복사하지 못했어요. 아래 JSON을 직접 선택해주세요." : "요약 좌표는 소수 8자리, JSON은 원본 정밀도로 표시합니다."}
            </p>

            {!request ? (
              <div className={styles.empty}>
                <strong>최근 데모 요청이 없어요</strong>
                <p>분석 조건에서 요청 버튼을 누르면<br />그 시점의 요청 데이터가 여기에 표시돼요.</p>
              </div>
            ) : request.grids.length === 0 ? (
              <div className={styles.empty}>
                <strong>선택한 그리드가 없어요</strong>
                <p>지도에서 그리드를 선택하면<br />대각 꼭지점 2개의 좌표가 표시돼요.</p>
              </div>
            ) : (
              <ul className={styles.gridList} aria-label="그리드별 요청 좌표" tabIndex={0}>
                {request.grids.map((grid) => {
                  const active = source === "preview" && grid.label === activeLabel;
                  return (
                    <li className={`${styles.gridCard} ${active ? styles.activeGrid : ""}`} key={grid.gridId} aria-current={active ? "true" : undefined}>
                      <div className={styles.gridHeader}>
                        <h4><span className={styles.gridBadge}>{grid.label}</span>후보 그리드 {grid.label}</h4>
                        {active && <span className={styles.activeLabel}>선택됨</span>}
                      </div>
                      <code className={styles.gridId}>{grid.gridId}</code>
                      <dl className={styles.coordinates}>
                        <div>
                          <dt>남서 <span>SW</span></dt>
                          <dd><span>lat <code>{formatCoordinate(grid.southWest.lat)}</code></span><span>lng <code>{formatCoordinate(grid.southWest.lng)}</code></span></dd>
                        </div>
                        <div>
                          <dt>북동 <span>NE</span></dt>
                          <dd><span>lat <code>{formatCoordinate(grid.northEast.lat)}</code></span><span>lng <code>{formatCoordinate(grid.northEast.lng)}</code></span></dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            )}

            {request && (
              <section className={styles.jsonSection} aria-label="전체 요청 JSON">
                <h3>전체 JSON</h3>
                <pre className={styles.json} tabIndex={0} aria-label="원본 정밀도 분석 요청 JSON"><code>{json}</code></pre>
              </section>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
