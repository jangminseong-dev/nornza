"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GlobalNavigation from "@/components/shared/GlobalNavigation";
import type { AnalysisSelection } from "@/types/analysis";
import { selectionCenter } from "@/lib/demo";
import KakaoMap from "@/components/map/KakaoMap";
import PlaceSearch from "@/components/map/PlaceSearch";
import { createMockSelection } from "@/lib/mock-analysis";
import type { MapRegion, MapTarget, PlaceResult } from "@/types/map";
import styles from "./AnalysisWorkspace.module.css";

interface AnalysisWorkspaceProps {
  /** The intro previews the layout without loading or authenticating the map. */
  preview?: boolean;
  hideNavigation?: boolean;
  initialSelection?: AnalysisSelection | null;
  onContinue?: (selection: AnalysisSelection) => void;
  onDemoStart?: () => void;
  onSelectionChange?: (selection: AnalysisSelection | null) => void;
}

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatValue(value: number | null | undefined, unit: string) {
  return value == null ? "—" : `${numberFormatter.format(value)}${unit}`;
}

function StatisticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statisticRow}>
      <dt>{label}</dt>
      <dd className={value === "—" ? styles.emptyValue : undefined}>{value}</dd>
    </div>
  );
}

export default function AnalysisWorkspace({ preview = false, hideNavigation = false, initialSelection, onContinue, onDemoStart, onSelectionChange }: AnalysisWorkspaceProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([...(initialSelection?.gridIds ?? [])]);
  const [region, setRegion] = useState<MapRegion | null>(null);
  const [selectionRegion, setSelectionRegion] = useState<MapRegion | null>(initialSelection?.address ? { name: initialSelection.address.replace(/ 인근$/, ""), breadcrumbs: [...initialSelection.breadcrumbs] } : null);
  const [focusTarget, setFocusTarget] = useState<MapTarget | null>(initialSelection ? { ...selectionCenter(initialSelection), requestId: 1, label: initialSelection.address ?? "선택 영역" } : null);
  const [mapReady, setMapReady] = useState(false);
  const selection = useMemo(() => createMockSelection(selectedIds, selectionRegion ? {
    ...selectionRegion,
    name: `${selectionRegion.name} 인근`,
  } : null), [selectedIds, selectionRegion]);
  const statistics = selection?.statistics;
  const breadcrumbs = region?.breadcrumbs.length ? region.breadcrumbs : ["—", "—", "—"];

  useEffect(() => {
    onSelectionChange?.(selection);
  }, [selection, onSelectionChange]);

  const toggleCell = useCallback((id: string) => {
    setSelectedIds((previous) => previous.includes(id)
      ? previous.filter((selectedId) => selectedId !== id)
      : [...previous, id]);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectionRegion(null);
  }, []);

  const selectPlace = useCallback((place: PlaceResult) => {
    clearSelection();
    setFocusTarget((previous) => ({
      lat: place.lat,
      lng: place.lng,
      label: place.name,
      requestId: (previous?.requestId ?? 0) + 1,
    }));
  }, [clearSelection]);

  return (
    <main className={`${styles.workspace} ${hideNavigation ? styles.embedded : ""}`}>
      {!hideNavigation && <GlobalNavigation />}

      <aside className={styles.contextPanel} aria-labelledby="analysis-title">
        <div className={styles.panelScroll}>
          <h1 id="analysis-title" className={styles.title}>어디를 분석할까요?</h1>

          <PlaceSearch onSelect={selectPlace} disabled={preview} />

          <div className={styles.segmentControl} role="group" aria-label="분석 영역 선택 방식">
            <button
              type="button"
              aria-pressed={false}
              disabled
              title="행정구역 선택 기능 준비 중"
            >
              행정구역
            </button>
            <button
              type="button"
              className={styles.segmentActive}
              aria-pressed={true}
              title="지도에서 100m 그리드를 클릭해 선택하세요"
            >
              직접 선택
            </button>
          </div>

          <section className={styles.selectedArea} aria-labelledby="selected-area-title">
            <h2 id="selected-area-title" className={styles.eyebrow}>선택한 분석 영역</h2>
            <p className={`${styles.areaAddress} ${!selection?.address ? styles.emptyValue : ""}`} aria-label={selection?.address ?? "선택한 지역 없음"}>
              {selection?.address ?? "—"}
            </p>
            <p className={`${styles.areaSize} ${selection?.areaSquareMeters == null ? styles.emptyValue : ""}`} aria-label={selection?.areaSquareMeters == null ? "선택한 면적 없음" : undefined}>
              {formatValue(selection?.areaSquareMeters, "㎡")}
            </p>
          </section>

          <section className={styles.regionInformation} aria-labelledby="region-information-title">
            <div className={styles.sectionHeading}>
              <h2 id="region-information-title" className={styles.sectionTitle}>지역 정보</h2>
              {selection && <span className={styles.simulationBadge} title="선택한 셀별 예시 값을 합산한 시연용 데이터입니다.">가상 데이터</span>}
            </div>
            <dl className={styles.statistics}>
              <StatisticRow label="거주인구" value={formatValue(statistics?.residentPopulation, "명")} />
              <StatisticRow label="유동인구" value={formatValue(statistics?.floatingPopulation, "명")} />
              <StatisticRow label="CU 점포" value={formatValue(statistics?.cuStoreCount, "개")} />
              <StatisticRow label="경쟁 편의점" value={formatValue(statistics?.competingStoreCount, "개")} />
              <StatisticRow label="상권 유형" value={statistics?.commercialType ?? "—"} />
            </dl>
          </section>

          <section className={styles.satelliteInformation} aria-labelledby="satellite-information-title">
            <div className={styles.sectionHeading}>
              <h2 id="satellite-information-title" className={styles.sectionTitle}>위성 데이터 분석</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/icon-lock.svg" width={24} height={24} alt="분석 전 잠김" />
            </div>
            <p className={styles.satelliteDescription}>
              분석을 요청하면 위성 데이터를 수집해<br />
              지역 정보를 더 자세히 분석해요.
            </p>
            <dl className={styles.satelliteStatistics}>
              {["야간 조도", "도시 밀도", "토지 이용", "공간 변화"].map((label) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>분석 요청 후 제공</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <footer className={styles.panelFooter}>
          <p>{selection ? `${selectedIds.length}개 그리드 선택 · 그리드별 후보를 비교해요` : "분석할 영역을 먼저 선택해주세요"}</p>
          <button className={styles.nextButton} type="button" disabled={!selection || !onContinue} onClick={() => { if (selection) onContinue?.(selection); }}>
            다음: 후보 그리드 비교 <span aria-hidden="true">→</span>
          </button>
        </footer>
      </aside>

      <section className={styles.mapPlaceholder} aria-label="분석 지도">
        {preview ? <div className={styles.mapGrid} aria-hidden="true" /> : (
          <KakaoMap
            selectedIds={selectedIds}
            onToggleCell={toggleCell}
            onRegionChange={setRegion}
            onSelectionRegionChange={setSelectionRegion}
            focusTarget={focusTarget}
            selectionEnabled={true}
            onReadyChange={setMapReady}
          />
        )}

        <div className={styles.mapBreadcrumb} aria-label="현재 지도 위치">
          <ol>
            {breadcrumbs.map((label, index) => (
              <li key={`${index}-${label}`}>{label}</li>
            ))}
          </ol>
          <span>현재 지도</span>
        </div>

        <div className={styles.north} aria-label="북쪽">N <span aria-hidden="true">↑</span></div>

        <div className={styles.mapGuidance} aria-live="polite">
          <h2>{selection ? `${selectedIds.length}개 그리드를 선택했어요` : "분석할 영역을 선택해주세요"}</h2>
          <p>
            {selection
              ? "선택한 셀을 다시 누르면 해제돼요. 지역 정보는 가상 합계예요."
              : "100m × 100m 그리드를 클릭해 분석할 영역을 만들어요."}
          </p>
        </div>

        {preview && <div className={styles.mapEmptyState}>
          <div className={styles.gridSymbol} aria-hidden="true">
            <span /><span /><span /><span />
          </div>
          <h2>분석할 지역을 살펴보세요</h2>
          <p>원하는 그리드를 선택하면<br />선택 영역의 정보를 확인할 수 있어요.</p>
        </div>}

        {!preview && <div className={styles.selectionTools}>
          <span>100m 그리드</span>
          <button type="button" onClick={clearSelection} disabled={!selectedIds.length || !mapReady}>
            선택 초기화{selectedIds.length ? ` (${selectedIds.length})` : ""}
          </button>
          {onDemoStart && <button type="button" onClick={onDemoStart}>예시 영역으로 데모 시작 →</button>}
        </div>}

        <div className={styles.mapLegend} aria-label="지도 범례" title="편의점 마커는 현재 화면에서 검색된 일부 점포이며, 왼쪽 가상 통계와는 별개입니다.">
          <span className={styles.cuLegend}><i aria-hidden="true" />CU 점포</span>
          <span><i aria-hidden="true" />경쟁 편의점</span>
          <span className={styles.selectionLegend}><i aria-hidden="true" />선택 영역</span>
          <span className={styles.legendNote}>검색된 일부 점포</span>
        </div>
      </section>
    </main>
  );
}
