import type { PlaceResult } from "@/types/map";

const KAKAO_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/";
const MAX_QUERY_LENGTH = 100;
const REQUEST_TIMEOUT_MS = 8_000;
const RESPONSE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

class SearchError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 500) : "";
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function coordinates(document: Record<string, unknown>) {
  if (!textValue(document.x) || !textValue(document.y)) return null;
  const lng = Number(document.x);
  const lat = Number(document.y);
  return Number.isFinite(lng) && Number.isFinite(lat)
    && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
    ? { lng, lat }
    : null;
}

function toPlace(value: unknown): PlaceResult | null {
  const document = record(value);
  const point = coordinates(document);
  const name = textValue(document.place_name);
  const id = textValue(document.id);
  if (!point || !name || !id) return null;

  return {
    id,
    name,
    address: textValue(document.road_address_name) || textValue(document.address_name),
    kind: "place",
    category: textValue(document.category_name),
    // Build a known Kakao destination instead of forwarding arbitrary URLs.
    url: /^\d+$/.test(id) ? `https://place.map.kakao.com/${id}` : undefined,
    ...point,
  };
}

function toAddress(value: unknown): PlaceResult | null {
  const document = record(value);
  const point = coordinates(document);
  const road = record(document.road_address);
  const address = textValue(road.address_name) || textValue(document.address_name);
  if (!point || !address) return null;

  return {
    id: `address:${point.lng}:${point.lat}:${address}`,
    name: textValue(road.building_name) || address,
    address,
    kind: "address",
    ...point,
  };
}

async function searchKakao(
  endpoint: "keyword.json" | "address.json",
  parameters: URLSearchParams,
  apiKey: string,
  signal: AbortSignal,
): Promise<PlaceResult[]> {
  const response = await fetch(`${KAKAO_SEARCH_URL}${endpoint}?${parameters}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    cache: "no-store",
    signal,
  });

  if (response.status === 401 || response.status === 403) {
    throw new SearchError("검색 서비스 연결을 확인하고 있어요. 잠시 후 다시 시도해주세요.", 503);
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new SearchError(
      "검색 요청 한도에 도달했어요. 잠시 후 다시 시도해주세요.",
      429,
      Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 3600) : 60,
    );
  }
  if (!response.ok) {
    throw new SearchError("검색 서비스에 연결하지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const payload = record(await response.json());
  if (!Array.isArray(payload.documents)) {
    throw new SearchError("검색 결과를 불러오지 못했어요. 다시 검색해주세요.");
  }

  return payload.documents
    .map(endpoint === "keyword.json" ? toPlace : toAddress)
    .filter((result): result is PlaceResult => result !== null);
}

export async function GET(request: Request) {
  const parameters = new URL(request.url).searchParams;
  const rawQuery = parameters.get("q") ?? "";
  const query = rawQuery.trim();

  if (query.length < 2 || rawQuery.length > MAX_QUERY_LENGTH) {
    return Response.json(
      { error: "검색어를 2자 이상, 100자 이하로 입력해주세요." },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  const x = parameters.get("x");
  const y = parameters.get("y");
  if ((x !== null || y !== null) && (
    !x || !y || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))
    || Number(x) < -180 || Number(x) > 180 || Number(y) < -90 || Number(y) > 90
  )) {
    return Response.json(
      { error: "검색 기준 위치가 올바르지 않아요." },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "검색 서비스를 준비하고 있어요. 잠시 후 다시 시도해주세요." },
      { status: 503, headers: RESPONSE_HEADERS },
    );
  }

  const keywordParameters = new URLSearchParams({ query, size: "8" });
  if (x && y) {
    keywordParameters.set("x", x);
    keywordParameters.set("y", y);
  }

  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
    const searches = await Promise.allSettled([
      searchKakao("keyword.json", keywordParameters, apiKey, signal),
      searchKakao("address.json", new URLSearchParams({ query, size: "8" }), apiKey, signal),
    ]);
    const places = searches[0].status === "fulfilled" ? searches[0].value : [];
    const addresses = searches[1].status === "fulfilled" ? searches[1].value : [];
    const seen = new Set<string>();
    const results: PlaceResult[] = [];

    // Keep addresses visible even when a place keyword returns a full page.
    for (const result of [...addresses.slice(0, 2), ...places, ...addresses.slice(2)]) {
      const identity = `${result.name.replace(/\s/g, "")}:${result.lat.toFixed(6)}:${result.lng.toFixed(6)}`;
      if (!seen.has(identity)) {
        seen.add(identity);
        results.push(result);
      }
      if (results.length === 8) break;
    }

    if (results.length === 0) {
      const failed = searches.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    }

    return Response.json({ results }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    if (error instanceof SearchError) {
      return Response.json(
        { error: error.message, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) },
        {
          status: error.status,
          headers: {
            ...RESPONSE_HEADERS,
            ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}),
          },
        },
      );
    }
    const isTimeout = error instanceof Error
      && (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json(
      { error: isTimeout
        ? "검색 응답이 지연되고 있어요. 잠시 후 다시 검색해주세요."
        : "검색 결과를 불러오지 못했어요. 잠시 후 다시 시도해주세요." },
      { status: isTimeout ? 504 : 502, headers: RESPONSE_HEADERS },
    );
  }
}
