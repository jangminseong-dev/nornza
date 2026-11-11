const SCRIPT_ID = "nornza-kakao-maps-sdk";
const LOAD_TIMEOUT_MS = 15_000;

let loadingPromise: Promise<typeof kakao.maps> | null = null;

function readyMaps() {
  const maps = window.kakao?.maps;
  return maps?.Map && maps.services?.Places && maps.services?.Geocoder ? maps : null;
}

/** Loads the browser SDK once; failed attempts are released so callers can retry. */
export function loadKakaoMaps(): Promise<typeof kakao.maps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("지도는 브라우저에서 사용할 수 있어요."));
  }

  const ready = readyMaps();
  if (ready) return Promise.resolve(ready);
  if (loadingPromise) return loadingPromise;

  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY?.trim();
  if (!appKey) {
    return Promise.reject(new Error("지도 연결 설정이 아직 준비되지 않았어요."));
  }

  const promise = new Promise<typeof kakao.maps>((resolve, reject) => {
    let settled = false;
    let loadingSdk = false;
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener("load", initialize);
      script.removeEventListener("error", onScriptError);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      reject(new Error(message));
    };

    const initialize = () => {
      if (settled || loadingSdk) return;
      loadingSdk = true;
      const maps = window.kakao?.maps;
      if (!maps?.load) {
        fail("지도를 연결하지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      try {
        maps.load(() => {
          if (settled) return;
          const loaded = readyMaps();
          if (!loaded) {
            fail("지도 기능을 불러오지 못했어요. 다시 시도해주세요.");
            return;
          }
          settled = true;
          cleanup();
          resolve(loaded);
        });
      } catch {
        fail("지도를 연결하지 못했어요. 다시 시도해주세요.");
      }
    };

    const onScriptError = () => fail("지도를 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.");
    const timeout = window.setTimeout(() => {
      fail("지도 연결이 지연되고 있어요. 잠시 후 다시 시도해주세요.");
    }, LOAD_TIMEOUT_MS);

    script.addEventListener("load", initialize);
    script.addEventListener("error", onScriptError);

    if (!existing) {
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
      document.head.appendChild(script);
    } else if (typeof window.kakao?.maps?.load === "function") {
      initialize();
    }
  });

  loadingPromise = promise;
  void promise.catch(() => {
    if (loadingPromise === promise) loadingPromise = null;
  });
  return promise;
}
