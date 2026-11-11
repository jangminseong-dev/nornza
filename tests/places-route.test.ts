import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { GET } from "../src/app/api/places/route";
import type { PlaceResult } from "../src/types/map";

interface SearchBody {
  results?: PlaceResult[];
  error?: string;
  retryAfter?: number;
}

// No credentials or live network are used. Run this suite serially because it
// temporarily replaces the process-local environment and fetch implementation.
describe("place search route", { concurrency: false }, () => {
  let originalFetch: typeof fetch;
  let originalKey: string | undefined;
  let requests: { url: URL; options?: RequestInit }[];

  function mockFetch(reply: (url: URL, options?: RequestInit) => Response | Promise<Response>) {
    globalThis.fetch = async (input, options) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push({ url, options });
      return reply(url, options);
    };
  }

  async function search(parameters: Record<string, string> = {}) {
    const response = await GET(new Request(`http://localhost/api/places?${new URLSearchParams(parameters)}`));
    const body = await response.json() as SearchBody;
    assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
    return { response, body };
  }

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalKey = process.env.KAKAO_REST_API_KEY;
    process.env.KAKAO_REST_API_KEY = "test-only-key-never-sent-to-kakao";
    requests = [];
    mockFetch(() => { throw new Error("Unexpected upstream request"); });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.KAKAO_REST_API_KEY;
    else process.env.KAKAO_REST_API_KEY = originalKey;
  });

  it("rejects missing, short, and oversized queries before calling upstream", async () => {
    for (const q of ["", " ", "a", "a".repeat(101)]) {
      assert.equal((await search({ q })).response.status, 400);
    }
    assert.equal((await search()).response.status, 400);
    assert.equal(requests.length, 0);
  });

  it("rejects incomplete, nonfinite, and out-of-range search centers", async () => {
    const invalidCenters: Array<Record<string, string>> = [
      { x: "127" }, { y: "36" }, { x: "", y: "36" },
      { x: "NaN", y: "36" }, { x: "127", y: "Infinity" },
      { x: "181", y: "36" }, { x: "127", y: "91" },
    ];
    for (const center of invalidCenters) {
      assert.equal((await search({ q: "둔산동", ...center })).response.status, 400);
    }
    assert.equal(requests.length, 0);
  });

  it("returns an unavailable state without making requests when the key is missing", async () => {
    delete process.env.KAKAO_REST_API_KEY;
    const { response, body } = await search({ q: "둔산동" });
    assert.equal(response.status, 503);
    assert.equal(typeof body.error, "string");
    assert.equal(requests.length, 0);
  });

  it("keeps queries encoded, uses only Kakao endpoints, and disables upstream caching", async () => {
    mockFetch(() => Response.json({ documents: [] }));
    const q = "둔산동 &x=evil?/#";
    const { response } = await search({ q, x: "127.38", y: "36.35" });
    assert.equal(response.status, 200);
    assert.equal(requests.length, 2);
    for (const { url, options } of requests) {
      assert.equal(url.origin, "https://dapi.kakao.com");
      assert.equal(url.searchParams.get("query"), q);
      assert.equal(options?.cache, "no-store");
      assert.ok(options?.signal instanceof AbortSignal);
    }
    const keyword = requests.find(({ url }) => url.pathname.endsWith("keyword.json"))!;
    assert.equal(keyword.url.searchParams.get("x"), "127.38");
    assert.equal(keyword.url.searchParams.get("y"), "36.35");
  });

  it("deduplicates mixed results, rejects invalid coordinates, and caps output at eight", async () => {
    mockFetch((url) => Response.json({ documents: url.pathname.endsWith("keyword.json")
      ? [
        { id: "0", place_name: "대전 서구 둔산동", x: "127.38", y: "36.35" },
        { id: "1", place_name: "잘못된 좌표", x: "NaN", y: "36.35" },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: String(i + 2), place_name: `장소 ${i}`, x: "127.38", y: "36.35",
          road_address_name: `대전 서구 ${i}`, place_url: "javascript:alert(1)",
        })),
      ]
      : [
        { address_name: "대전 서구 둔산동", x: "127.38", y: "36.35" },
        { address_name: "대전 서구 둔산동", x: "127.38", y: "36.35" },
      ] }));
    const { body } = await search({ q: "둔산동" });
    const results = body.results!;
    assert.equal(results.length, 8);
    assert.equal(results.filter((result) => result.name === "대전 서구 둔산동").length, 1);
    assert.ok(results.every((result) => Number.isFinite(result.lat) && Number.isFinite(result.lng)));
    assert.ok(results.every((result) => !result.url || result.url.startsWith("https://place.map.kakao.com/")));
    assert.ok(!JSON.stringify(body).includes("test-only-key"));
  });

  it("sanitizes upstream authentication and permission failures", async () => {
    for (const status of [401, 403]) {
      mockFetch(() => Response.json({ message: "upstream-secret-detail", key: "test-only-key" }, { status }));
      const { response, body } = await search({ q: "둔산동" });
      assert.equal(response.status, 503);
      assert.ok(body.error);
      assert.ok(!JSON.stringify(body).includes("upstream-secret-detail"));
      assert.ok(!JSON.stringify(body).includes("test-only-key"));
    }
  });

  it("propagates a bounded rate-limit retry hint without exposing upstream content", async () => {
    mockFetch(() => Response.json({ message: "quota-secret-detail" }, {
      status: 429, headers: { "Retry-After": "30" },
    }));
    const { response, body } = await search({ q: "둔산동" });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "30");
    assert.equal(body.retryAfter, 30);
    assert.ok(!JSON.stringify(body).includes("quota-secret-detail"));
  });

  it("returns useful address results when the keyword service fails", async () => {
    mockFetch((url) => url.pathname.endsWith("keyword.json")
      ? Response.json({ message: "failed" }, { status: 500 })
      : Response.json({ documents: [{ address_name: "대전 서구 둔산동", x: "127.38", y: "36.35" }] }));
    const { response, body } = await search({ q: "둔산동" });
    assert.equal(response.status, 200);
    assert.equal(body.results?.length, 1);
    assert.equal(body.results?.[0].kind, "address");
  });

  it("distinguishes an empty successful search from upstream failure", async () => {
    mockFetch(() => Response.json({ documents: [] }));
    const empty = await search({ q: "없는주소" });
    assert.equal(empty.response.status, 200);
    assert.deepEqual(empty.body.results, []);

    mockFetch(() => Response.json({ message: "internal failure" }, { status: 500 }));
    const failed = await search({ q: "둔산동" });
    assert.equal(failed.response.status, 502);
    assert.ok(!JSON.stringify(failed.body).includes("internal failure"));
  });

  it("reports timeouts as retryable gateway failures", async () => {
    mockFetch(() => { throw new DOMException("Upstream socket detail", "TimeoutError"); });
    const { response, body } = await search({ q: "둔산동" });
    assert.equal(response.status, 504);
    assert.ok(body.error);
    assert.ok(!JSON.stringify(body).includes("Upstream socket detail"));
  });
});
