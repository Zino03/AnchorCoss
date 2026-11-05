import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handler, { _clearCache } from "./weather.js";

const SAMPLE = JSON.stringify({
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
    body: {
      items: {
        item: [
          ["PTY", "1"], ["RN1", "3.5"], ["T1H", "12.1"], ["REH", "90"], ["WSD", "2.0"],
        ].map(([category, obsrValue]) => ({ baseDate: "20261105", baseTime: "1700", category, nx: 68, ny: 106, obsrValue })),
      },
    },
  },
});

/** Vercel/devApi와 같은 res 모양 */
function fakeRes() {
  const r = { statusCode: 200, body: null, headers: {} };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  r.setHeader = (k, v) => (r.headers[k] = v);
  return r;
}

describe("api/weather", () => {
  beforeEach(() => {
    _clearCache();
    process.env.KMA_SERVICE_KEY = "test-key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KMA_SERVICE_KEY;
  });

  it("키가 없으면 500", async () => {
    delete process.env.KMA_SERVICE_KEY;
    const res = fakeRes();
    await handler({ url: "/api/weather" }, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.ok).toBe(false);
  });

  it("기본 지역(REGION)으로 조회하고 키는 응답에 없다", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, text: async () => SAMPLE }));
    vi.stubGlobal("fetch", f);
    const res = fakeRes();
    await handler({ url: "/api/weather" }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, rainMm: 3.5, ptyLabel: "비", tempC: 12.1 });
    expect(f.mock.calls[0][0].searchParams.get("nx")).toBe("68"); // 충북대 부근
    expect(JSON.stringify(res.body)).not.toContain("test-key");
  });

  it("10분 안의 재요청은 캐시", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, text: async () => SAMPLE }));
    vi.stubGlobal("fetch", f);
    await handler({ url: "/api/weather" }, fakeRes());
    const res = fakeRes();
    await handler({ url: "/api/weather" }, res);
    expect(f).toHaveBeenCalledTimes(1);
    expect(res.body.cached).toBe(true);
  });

  it("기상청 오류면 502, 직전 값이 있으면 stale로 응답", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, text: async () => "" })));
    const res = fakeRes();
    await handler({ url: "/api/weather" }, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/HTTP503/);
  });

  it("lat/lng 쿼리로 다른 지역", async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, text: async () => SAMPLE }));
    vi.stubGlobal("fetch", f);
    await handler({ url: "/api/weather?lat=37.5665&lng=126.978" }, fakeRes());
    expect(f.mock.calls[0][0].searchParams.get("nx")).toBe("60");
  });
});
