"use client";

import { useEffect, useRef, useState } from "react";
import { getCellAtPoint, getCellById, getVisibleCells } from "@/lib/grid";
import { loadKakaoMaps } from "@/lib/kakao-loader";
import type { GeoBounds, GridCell, MapAnnotation, MapRegion, MapTarget } from "@/types/map";
import styles from "./KakaoMap.module.css";

interface KakaoMapProps {
  selectedIds: readonly string[];
  onToggleCell: (id: string) => void;
  onRegionChange: (region: MapRegion | null) => void;
  onSelectionRegionChange?: (region: MapRegion | null) => void;
  focusTarget: MapTarget | null;
  selectionEnabled: boolean;
  onReadyChange?: (ready: boolean) => void;
  annotations?: readonly MapAnnotation[];
  onAnnotationClick?: (id: string) => void;
}

interface PolygonEntry {
  polygon: kakao.maps.Polygon;
  listeners: { type: string; callback: kakao.maps.event.Listener }[];
}

interface StoreEntry {
  overlay: kakao.maps.CustomOverlay;
  element: HTMLButtonElement;
  click: (event: MouseEvent) => void;
}

const INITIAL_CENTER = { lat: 36.3504, lng: 127.3845 };
const INITIAL_LEVEL = 3;
const MAX_GRID_LEVEL = 5;
const MAX_VISIBLE_CELLS = 1000;

function regionFromResults(results: kakao.maps.services.RegionResult[]): MapRegion | null {
  const region = results.find((result) => result.region_type === "H") ?? results[0];
  if (!region) return null;
  return {
    name: region.address_name,
    breadcrumbs: [region.region_1depth_name, region.region_2depth_name, region.region_3depth_name].filter(Boolean),
  };
}

function geoBounds(bounds: kakao.maps.LatLngBounds): GeoBounds {
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();
  return {
    south: southWest.getLat(),
    west: southWest.getLng(),
    north: northEast.getLat(),
    east: northEast.getLng(),
  };
}

export default function KakaoMap(props: KakaoMapProps) {
  const { selectedIds, selectionEnabled, focusTarget } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const mapsRef = useRef<typeof kakao.maps | null>(null);
  const geocoderRef = useRef<kakao.maps.services.Geocoder | null>(null);
  const propsRef = useRef(props);
  const renderGridRef = useRef<(() => void) | null>(null);
  const selectionRequestRef = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [zoomLevel, setZoomLevel] = useState(INITIAL_LEVEL);
  const [gridLimited, setGridLimited] = useState(false);
  const [placesUnavailable, setPlacesUnavailable] = useState(false);
  const firstSelectedId = selectedIds[0] ?? null;

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let resizeFrame = 0;
    let requestVersion = 0;
    let lastPolygonClick = { id: "", time: 0 };
    let gridCanSelect = true;
    let releaseMap = () => {};

    setPhase("loading");
    setError("");
    propsRef.current.onReadyChange?.(false);

    void loadKakaoMaps().then((maps) => {
      const canvas = canvasRef.current;
      if (disposed || !canvas) return;

      const map = new maps.Map(canvas, {
        center: new maps.LatLng(INITIAL_CENTER.lat, INITIAL_CENTER.lng),
        level: INITIAL_LEVEL,
        disableDoubleClickZoom: true,
        keyboardShortcuts: false,
      });
      map.setMinLevel(1);
      map.setMaxLevel(13);
      mapsRef.current = maps;
      mapRef.current = map;
      const polygons = new Map<string, PolygonEntry>();
      let stores: StoreEntry[] = [];
      const mapListeners: { type: string; callback: kakao.maps.event.Listener }[] = [];

      const removePolygon = (entry: PolygonEntry) => {
        entry.listeners.forEach(({ type, callback }) => maps.event.removeListener(entry.polygon, type, callback));
        entry.polygon.setMap(null);
      };

      const clearStores = () => {
        stores.forEach(({ overlay, element, click }) => {
          element.removeEventListener("click", click);
          overlay.setMap(null);
        });
        stores = [];
      };

      releaseMap = () => {
        mapListeners.forEach(({ type, callback }) => maps.event.removeListener(map, type, callback));
        polygons.forEach(removePolygon);
        polygons.clear();
        clearStores();
        map.setDraggable(false);
        map.setZoomable(false);
        map.setKeyboardShortcuts(false);
        if (mapRef.current === map) {
          mapRef.current = null;
          mapsRef.current = null;
          geocoderRef.current = null;
          renderGridRef.current = null;
        }
        canvas.replaceChildren();
      };

      const geocoder = new maps.services.Geocoder();
      const places = new maps.services.Places();
      geocoderRef.current = geocoder;

      const paintPolygon = (id: string, polygon: kakao.maps.Polygon, hovered = false) => {
        const selected = propsRef.current.selectedIds.includes(id);
        polygon.setOptions({
          strokeColor: selected ? "#ab8700" : hovered ? "#b29a38" : "#71776a",
          strokeOpacity: selected ? 0.95 : hovered ? 0.7 : 0.22,
          strokeWeight: selected ? 2 : 1,
          fillColor: "#f4df24",
          fillOpacity: selected ? 0.36 : hovered ? 0.14 : 0,
        });
        polygon.setZIndex(selected ? 3 : hovered ? 2 : 1);
      };

      const toggleCell = (id: string) => {
        if (!propsRef.current.selectionEnabled) return;
        if (!gridCanSelect && !propsRef.current.selectedIds.includes(id)) return;
        propsRef.current.onToggleCell(id);
      };

      const renderGrid = () => {
        if (disposed) return;
        const level = map.getLevel();
        setZoomLevel(level);
        const cells = level <= MAX_GRID_LEVEL ? getVisibleCells(geoBounds(map.getBounds()), MAX_VISIBLE_CELLS) : [];
        gridCanSelect = level <= MAX_GRID_LEVEL && cells.length > 0;
        setGridLimited(!gridCanSelect);
        const wanted = new Map<string, GridCell>();
        if (propsRef.current.selectionEnabled) cells.forEach((cell) => wanted.set(cell.id, cell));

        // Selected cells survive viewport/zoom changes; a zoom limit only hides the unselected grid.
        propsRef.current.selectedIds.forEach((id) => {
          const cell = getCellById(id);
          if (cell) wanted.set(id, cell);
        });

        polygons.forEach((entry, id) => {
          if (!wanted.has(id)) {
            removePolygon(entry);
            polygons.delete(id);
          }
        });

        wanted.forEach((cell, id) => {
          const existing = polygons.get(id);
          if (existing) {
            paintPolygon(id, existing.polygon);
            return;
          }
          const polygon = new maps.Polygon({
            map,
            path: cell.corners.map((point) => new maps.LatLng(point.lat, point.lng)),
          });
          const listeners: PolygonEntry["listeners"] = [
            {
              type: "click",
              callback: () => {
                maps.event.preventMap();
                lastPolygonClick = { id, time: performance.now() };
                toggleCell(id);
              },
            },
            {
              type: "mouseover",
              callback: () => {
                if (!propsRef.current.selectionEnabled) return;
                if (!gridCanSelect && !propsRef.current.selectedIds.includes(id)) return;
                map.setCursor("pointer");
                paintPolygon(id, polygon, true);
              },
            },
            {
              type: "mouseout",
              callback: () => {
                map.setCursor("");
                paintPolygon(id, polygon);
              },
            },
          ];
          listeners.forEach(({ type, callback }) => maps.event.addListener(polygon, type, callback));
          polygons.set(id, { polygon, listeners });
          paintPolygon(id, polygon);
        });
      };
      renderGridRef.current = renderGrid;

      const renderStores = (results: kakao.maps.services.PlaceResult[]) => {
        clearStores();
        results.slice(0, 15).forEach((place) => {
          const lat = Number(place.y);
          const lng = Number(place.x);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const isCu = /^CU(?:\s|$)/i.test(place.place_name);
          const element = document.createElement("button");
          element.type = "button";
          element.disabled = !propsRef.current.selectionEnabled;
          element.className = `${styles.storeMarker} ${isCu ? styles.cuMarker : ""}`;
          element.textContent = isCu ? "CU" : "편";
          element.title = place.place_name;
          element.setAttribute("aria-label", propsRef.current.selectionEnabled ? `${place.place_name} 부근 격자 선택` : place.place_name);
          const click = (event: MouseEvent) => {
            event.stopPropagation();
            maps.event.preventMap();
            try {
              const cell = getCellAtPoint({ lat, lng });
              lastPolygonClick = { id: cell.id, time: performance.now() };
              toggleCell(cell.id);
            } catch {
              // Coordinates outside the supported grid projection cannot be selected.
            }
          };
          element.addEventListener("click", click);
          const overlay = new maps.CustomOverlay({
            map,
            position: new maps.LatLng(lat, lng),
            content: element,
            clickable: true,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: 5,
          });
          stores.push({ overlay, element, click });
        });
      };

      const refreshLocation = () => {
        if (disposed) return;
        const version = ++requestVersion;
        const center = map.getCenter();
        geocoder.coord2RegionCode(center.getLng(), center.getLat(), (results, status) => {
          if (disposed || requestVersion !== version) return;
          propsRef.current.onRegionChange(status === maps.services.Status.OK ? regionFromResults(results) : null);
        });
        places.categorySearch("CS2", (results, status) => {
          if (disposed || requestVersion !== version) return;
          setPlacesUnavailable(status === maps.services.Status.ERROR);
          renderStores(status === maps.services.Status.OK ? results : []);
        }, { bounds: map.getBounds(), size: 15, page: 1 });
      };

      const onIdle = () => {
        renderGrid();
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshLocation, 450);
      };

      const invalidateLocation = () => {
        // Prevent an earlier location's response from being applied during the next pan.
        requestVersion += 1;
        clearTimeout(refreshTimer);
      };

      const addMapListener = (type: string, callback: kakao.maps.event.Listener) => {
        maps.event.addListener(map, type, callback);
        mapListeners.push({ type, callback });
      };

      addMapListener("idle", onIdle);
      addMapListener("center_changed", invalidateLocation);
      addMapListener("zoom_changed", () => {
        invalidateLocation();
        renderGrid();
      });
      addMapListener("click", (event) => {
        if (!propsRef.current.selectionEnabled || !gridCanSelect) return;
        try {
          const cell = getCellAtPoint({ lat: event.latLng.getLat(), lng: event.latLng.getLng() });
          if (lastPolygonClick.id === cell.id && performance.now() - lastPolygonClick.time < 80) return;
          toggleCell(cell.id);
        } catch {
          // The grid intentionally has no cells outside its Korean projection area.
        }
      });

      resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          if (disposed) return;
          const center = map.getCenter();
          map.relayout();
          map.setCenter(center);
          onIdle();
        });
      });
      resizeObserver.observe(canvas);

      renderGrid();
      refreshLocation();
      setPhase("ready");
      propsRef.current.onReadyChange?.(true);
    }).catch((cause: unknown) => {
      if (disposed) return;
      requestVersion += 1;
      clearTimeout(refreshTimer);
      cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      releaseMap();
      canvasRef.current?.replaceChildren();
      setError(cause instanceof Error ? cause.message : "지도를 연결하지 못했어요. 다시 시도해주세요.");
      setPhase("error");
      propsRef.current.onReadyChange?.(false);
    });

    return () => {
      disposed = true;
      requestVersion += 1;
      selectionRequestRef.current += 1;
      clearTimeout(refreshTimer);
      cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      releaseMap();
      propsRef.current.onReadyChange?.(false);
    };
  }, [attempt]);

  useEffect(() => {
    renderGridRef.current?.();
  }, [selectedIds, selectionEnabled, phase]);

  useEffect(() => {
    const version = ++selectionRequestRef.current;
    propsRef.current.onSelectionRegionChange?.(null);
    if (phase !== "ready" || !firstSelectedId || !geocoderRef.current) return;
    const cell = getCellById(firstSelectedId);
    if (!cell) return;
    geocoderRef.current.coord2RegionCode(cell.center.lng, cell.center.lat, (results, status) => {
      if (selectionRequestRef.current !== version) return;
      const region = status === "OK" ? regionFromResults(results) : null;
      propsRef.current.onSelectionRegionChange?.(region);
    });
    return () => { selectionRequestRef.current += 1; };
  }, [firstSelectedId, phase]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (phase !== "ready" || !focusTarget || !map || !maps) return;
    map.setLevel(focusTarget.level ?? INITIAL_LEVEL);
    map.panTo(new maps.LatLng(focusTarget.lat, focusTarget.lng));
  }, [focusTarget, phase]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (phase !== "ready" || !map || !maps) return;
    const overlays: kakao.maps.CustomOverlay[] = [];
    const polygons: kakao.maps.Polygon[] = [];
    const cleanups: (() => void)[] = [];
    (props.annotations ?? []).forEach((annotation) => {
      const isCandidate = annotation.tone === "candidate";
      const isGridScore = annotation.variant === "grid-score";
      const color = annotation.active || annotation.tone === "selected" ? "#806000" : annotation.tone === "completed" ? "#148154" : "#ad902c";
      (annotation.gridIds ?? []).forEach((id) => {
        const cell = getCellById(id);
        if (!cell) return;
        const polygon = new maps.Polygon({ map, path: cell.corners.map(p => new maps.LatLng(p.lat, p.lng)), strokeColor: color, strokeWeight: annotation.active ? 3 : 1.5, strokeOpacity: 0.9, strokeStyle: annotation.tone === "processing" || annotation.tone === "prospect" ? "dash" : "solid", fillColor: annotation.active ? "#f4df24" : annotation.tone === "completed" ? "#b0e4cd" : "#f4df24", fillOpacity: annotation.tone === "prospect" ? 0.08 : isCandidate ? annotation.active ? 0.42 : 0.14 : 0.3, zIndex: annotation.active ? 4 : 3 });
        const click = () => { maps.event.preventMap(); propsRef.current.onAnnotationClick?.(annotation.id); };
        maps.event.addListener(polygon, "click", click);
        cleanups.push(() => maps.event.removeListener(polygon, "click", click));
        polygons.push(polygon);
      });
      const element = document.createElement("button");
      element.type = "button";
      element.className = `${isCandidate ? styles.candidateMarker : isGridScore ? styles.gridScoreMarker : styles.scoreMarker} ${annotation.active ? styles.annotationActive : ""}`;
      element.style.setProperty("--annotation-color", color);
      element.setAttribute("aria-label", `${annotation.label} ${annotation.description ?? ""}`.trim());
      element.setAttribute("aria-pressed", String(!!annotation.active));
      element.title = annotation.description ?? annotation.label;
      const label = document.createElement("strong");
      label.textContent = annotation.label;
      element.append(label);
      if (!isCandidate && !isGridScore && annotation.description) {
        const caption = document.createElement("span"); caption.textContent = annotation.description; element.append(caption);
      }
      const click = (event: MouseEvent) => { event.stopPropagation(); maps.event.preventMap(); propsRef.current.onAnnotationClick?.(annotation.id); };
      element.addEventListener("click", click);
      cleanups.push(() => element.removeEventListener("click", click));
      overlays.push(new maps.CustomOverlay({ map, position: new maps.LatLng(annotation.point.lat, annotation.point.lng), content: element, clickable: true, xAnchor: 0.5, yAnchor: 0.5, zIndex: annotation.active ? 20 : 10 }));
    });
    return () => { cleanups.forEach(cleanup => cleanup()); overlays.forEach(overlay => overlay.setMap(null)); polygons.forEach(polygon => polygon.setMap(null)); };
  }, [props.annotations, phase]);

  const changeZoom = (direction: -1 | 1) => {
    const map = mapRef.current;
    if (!map) return;
    map.setLevel(Math.min(13, Math.max(1, map.getLevel() + direction)), { animate: true });
  };

  const resetLocation = () => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    map.setLevel(INITIAL_LEVEL);
    map.panTo(new maps.LatLng(INITIAL_CENTER.lat, INITIAL_CENTER.lng));
  };

  return (
    <div className={styles.mapRoot}>
      <div ref={canvasRef} className={styles.canvas} aria-label={selectionEnabled ? "카카오 지도. 지도를 이동하고 정사각형 격자를 클릭해 분석 영역을 선택하세요." : "카카오 지도. 지도 위의 표시를 선택해 상세 정보를 확인하세요."} />

      {phase !== "ready" && (
        <div className={styles.loadingState} role="status" aria-live="polite">
          <div className={`${styles.statusSymbol} ${phase === "loading" ? styles.loadingSymbol : ""}`} aria-hidden="true"><span /><span /><span /><span /></div>
          <h2>{phase === "loading" ? "주변의 가능성을 불러오고 있어요" : "지도를 연결하지 못했어요"}</h2>
          <p>{phase === "loading" ? "잠시만 기다리면 지도를 살펴볼 수 있어요." : error}</p>
          {phase === "error" && <button type="button" className={styles.retryButton} onClick={() => setAttempt((value) => value + 1)}>다시 시도</button>}
        </div>
      )}

      {phase === "ready" && (
        <>
          {gridLimited && selectionEnabled && <p className={styles.zoomHint} role="status">지도를 확대하면 100m 격자를 선택할 수 있어요</p>}
          {placesUnavailable && <p className={styles.placesNotice} role="status">주변 편의점 정보를 잠시 불러오지 못했어요</p>}
          <div className={styles.mapControls} aria-label="지도 조작">
            <button type="button" className={styles.locationButton} onClick={resetLocation} title="대전 둔산동으로 이동" aria-label="기본 위치인 대전 둔산동으로 이동">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            <div className={styles.zoomButtons}>
              <button type="button" onClick={() => changeZoom(-1)} disabled={zoomLevel <= 1} aria-label="지도 확대" title="확대"><span aria-hidden="true">+</span></button>
              <button type="button" onClick={() => changeZoom(1)} disabled={zoomLevel >= 13} aria-label="지도 축소" title="축소"><span aria-hidden="true">−</span></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
