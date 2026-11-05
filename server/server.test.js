import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";
import { openDb, _setDb } from "./db.js";
import { normalizeSample, normalizeBatch, MAX_BATCH } from "./ingest.js";
import sensorData from "../api/sensor-data.js";
import stations from "../api/stations.js";

const NOW = Date.parse("2026-11-05T20:00:00+09:00");

describe("ingest.normalizeSample", () => {
  const ctx = { receivedAt: NOW, rainMm: 2 };

  it("정상 샘플 + 숫자 문자열 허용 + 강우는 서버 값", () => {
    const r = normalizeSample({ stationId: "st-1", ts: NOW - 5000, leftG: "312", rightG: 287.5, rssi: -58.4, batteryPct: 91 }, ctx);
    expect(r.sample).toEqual({ stationId: "st-1", ts: NOW - 5000, receivedAt: NOW, leftG: 312, rightG: 287.5, rssi: -58, batteryPct: 91, rainMm: 2 });
    expect(r.tsAdjusted).toBe(false);
  });

  it("센서 이상값(음수·null)은 거절하지 않는다", () => {
    const r = normalizeSample({ stationId: "st-1", leftG: -350, rightG: null }, ctx);
    expect(r.sample).toMatchObject({ leftG: -350, rightG: null, ts: NOW });
  });

  it("ts: 초 단위 변환, 미래·너무 오래된 시각은 수신 시각으로", () => {
    expect(normalizeSample({ stationId: "a", ts: Math.floor((NOW - 3000) / 1000), leftG: 1, rightG: 1 }, ctx).sample.ts).toBe(
      Math.floor((NOW - 3000) / 1000) * 1000,
    );
    const future = normalizeSample({ stationId: "a", ts: NOW + 5 * 60_000, leftG: 1, rightG: 1 }, ctx);
    expect(future.sample.ts).toBe(NOW);
    expect(future.tsAdjusted).toBe(true);
    expect(normalizeSample({ stationId: "a", ts: 1000, leftG: 1, rightG: 1 }, ctx).sample.ts).toBe(NOW); // 시계 미설정(1970)
  });

  it("형식 오류는 거절", () => {
    expect(normalizeSample(null, ctx).error).toBeTruthy();
    expect(normalizeSample({ stationId: "st 1", leftG: 1, rightG: 1 }, ctx).error).toMatch(/stationId/);
    expect(normalizeSample({ stationId: "st-1", leftG: 1 }, ctx).error).toMatch(/rightG/);
    expect(normalizeSample({ stationId: "st-1", leftG: "abc", rightG: 1 }, ctx).error).toMatch(/leftG/);
  });

  it("배치: 일부 오류는 rejected로, 최대 건수 제한", () => {
    const r = normalizeBatch([{ stationId: "a", leftG: 1, rightG: 1 }, { stationId: "a" }], { receivedAt: NOW });
    expect(r.samples).toHaveLength(1);
    expect(r.rejected).toEqual([{ index: 1, error: expect.any(String) }]);
    expect(normalizeBatch(Array(MAX_BATCH + 1).fill({}), { receivedAt: NOW }).error).toBeTruthy();
  });
});

describe("db", () => {
  let db;
  beforeEach(() => (db = openDb(":memory:")));
  afterEach(() => db.close());

  const s = (ts, leftG = 100, extra = {}) => ({ stationId: "st-1", ts, receivedAt: ts, leftG, rightG: 50, rainMm: null, rssi: -60, batteryPct: 90, ...extra });

  it("저장·조회, 지점 자동 등록(기본 지점이면 이름·좌표 채움)", () => {
    expect(db.insertMany([s(1000), s(2000)])).toEqual({ inserted: 2, duplicates: 0 });
    const st = db.listStations();
    expect(st).toHaveLength(1);
    expect(st[0]).toMatchObject({ id: "st-1", name: "빗물받이 #1 (실물)" });
    expect(st[0].lat).toBeTypeOf("number");
    expect(st[0].latest).toMatchObject({ ts: 2000, leftG: 100, rightG: 50 });
  });

  it("같은 시각·같은 값은 중복으로 무시, 값이 다르면 1ms 밀어서 보관", () => {
    db.insertMany([s(1000)]);
    expect(db.insertMany([s(1000)])).toEqual({ inserted: 0, duplicates: 1 });
    expect(db.insertMany([s(1000, 999)])).toEqual({ inserted: 1, duplicates: 0 });
    expect(db.history("st-1").samples.map((x) => [x.ts, x.leftG])).toEqual([[1000, 100], [1001, 999]]);
  });

  it("이상값(음수·null)도 그대로 저장", () => {
    db.insertMany([s(1000, -350, { rightG: null })]);
    expect(db.history("st-1").samples[0]).toMatchObject({ leftG: -350, rightG: null });
  });

  it("history: since(초기 로드)와 afterId(폴링)", () => {
    db.insertMany([s(1000), s(2000), s(3000)]);
    const first = db.history("st-1", { since: 2000 });
    expect(first.samples.map((x) => x.ts)).toEqual([2000, 3000]);
    expect(first.lastId).toBe(3);
    db.insertMany([s(4000)]);
    const next = db.history("st-1", { afterId: first.lastId });
    expect(next.samples.map((x) => x.ts)).toEqual([4000]);
    expect(db.history("st-1", { afterId: next.lastId })).toEqual({ samples: [], lastId: next.lastId });
  });

  it("초기 로드가 limit을 넘으면 최신 건을 주고, 이후 폴링에 빈 구간이 생기지 않는다 (1초 간격 대비)", () => {
    db.insertMany(Array.from({ length: 300 }, (_, i) => s(1000 + i * 1000, i)));
    const first = db.history("st-1", { since: 0, limit: 100 });
    expect(first.samples).toHaveLength(100);
    expect(first.samples[0].leftG).toBe(200); // 오래된 쪽을 버림
    expect(first.samples.at(-1).leftG).toBe(299); // 최신까지 포함
    expect(first.samples.map((x) => x.ts)).toEqual([...first.samples.map((x) => x.ts)].sort((a, b) => a - b));
    db.insertMany([s(1_000_000, 777)]);
    expect(db.history("st-1", { afterId: first.lastId }).samples.map((x) => x.leftG)).toEqual([777]);
  });

  it("트랜잭션: 하나라도 실패하면 전부 롤백", () => {
    const many = Array.from({ length: 60 }, () => s(1000, Math.random()));
    expect(() => db.insertMany([s(5000), ...many])).toThrow();
    expect(db.history("st-1").samples).toHaveLength(0);
  });
});

// ---- API 핸들러 ----
function fakeRes() {
  const r = { statusCode: 200, body: null, headers: {} };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  r.setHeader = (k, v) => (r.headers[k] = v);
  return r;
}
/** 개발 서버처럼 본문을 스트림으로 주는 요청 */
function streamReq({ method = "POST", url = "/", headers = {}, body }) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))]);
  return Object.assign(req, { method, url, headers });
}

describe("API /api/sensor-data, /api/stations", () => {
  let db;
  beforeEach(() => {
    db = openDb(":memory:");
    _setDb(db);
    process.env.DEVICE_TOKEN = "secret-token";
    delete process.env.VERCEL;
  });
  afterEach(() => {
    db.close();
    _setDb(null);
    delete process.env.DEVICE_TOKEN;
  });

  const post = async (body, headers = { "x-device-token": "secret-token" }) => {
    const res = fakeRes();
    await sensorData(streamReq({ headers, body }), res);
    return res;
  };

  it("토큰 없거나 틀리면 401, 서버에 토큰 설정이 없으면 503", async () => {
    expect((await post({ stationId: "st-1", leftG: 1, rightG: 1 }, {})).statusCode).toBe(401);
    expect((await post({ stationId: "st-1", leftG: 1, rightG: 1 }, { "x-device-token": "wrong" })).statusCode).toBe(401);
    delete process.env.DEVICE_TOKEN;
    expect((await post({ stationId: "st-1", leftG: 1, rightG: 1 })).statusCode).toBe(503);
  });

  it("단건·배열 수신 → 저장, 일부 오류는 rejected", async () => {
    const r1 = await post({ stationId: "st-1", leftG: 300, rightG: 280 });
    expect(r1.statusCode).toBe(200);
    expect(r1.body).toMatchObject({ ok: true, accepted: 1 });

    const now = Date.now();
    const r2 = await post([
      { stationId: "st-1", ts: now - 2000, leftG: 310, rightG: 290 },
      { stationId: "st-1", leftG: "x", rightG: 1 },
    ]);
    expect(r2.body).toMatchObject({ ok: true, accepted: 1, rejected: [{ index: 1 }] });
    expect(db.history("st-1").samples).toHaveLength(2);
  });

  it("JSON 아님·전부 오류·GET은 거절", async () => {
    expect((await post("not json")).statusCode).toBe(400);
    expect((await post({ stationId: "st-1" })).statusCode).toBe(400);
    const res = fakeRes();
    await sensorData(streamReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });

  it("Vercel에서는 501 (SQLite 불가)", async () => {
    process.env.VERCEL = "1";
    expect((await post({ stationId: "st-1", leftG: 1, rightG: 1 })).statusCode).toBe(501);
    delete process.env.VERCEL;
  });

  it("조회: 지점 목록, since/afterId 이력", async () => {
    const now = Date.now();
    await post([
      { stationId: "st-1", ts: now - 3000, leftG: 1, rightG: 1 },
      { stationId: "st-1", ts: now - 2000, leftG: 2, rightG: 2 },
    ]);
    const get = async (url) => {
      const res = fakeRes();
      await stations(streamReq({ method: "GET", url }), res);
      return res.body;
    };
    expect((await get("/")).stations[0]).toMatchObject({ id: "st-1", latest: { leftG: 2 } });
    const h = await get(`/?id=st-1&since=${now - 60_000}`);
    expect(h.samples.map((x) => x.leftG)).toEqual([1, 2]);
    await post({ stationId: "st-1", ts: now - 1000, leftG: 3, rightG: 3 });
    const p = await get(`/?id=st-1&afterId=${h.lastId}`);
    expect(p.samples.map((x) => x.leftG)).toEqual([3]);
  });
});
