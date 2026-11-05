import { describe, it, expect } from "vitest";
import { createEngine } from "./engine.js";
import { createSimulator, DEFAULT_STATIONS } from "./simulator.js";
import { STATES } from "../logic/states.js";

const make = (opt = {}) => createEngine({ sim: createSimulator({ seed: 1, startTs: 0 }), ...opt });
const run = (e, n) => {
  const evs = [];
  for (let i = 0; i < n; i++) evs.push(...e.step());
  return evs;
};

describe("engine", () => {
  it("한 스텝 후 모든 지점에 샘플·판정이 있다", () => {
    const e = make();
    e.step();
    const { stations, now } = e.snapshot();
    expect(now).toBe(10_000);
    expect(stations).toHaveLength(DEFAULT_STATIONS.length);
    for (const s of stations) {
      expect(s.latest).not.toBeNull();
      expect(Object.values(STATES)).toContain(s.judgement.state);
      expect(s).toHaveProperty("lat");
    }
  });

  it("상태 전환이 이벤트와 지점 이력에 기록된다", () => {
    const e = make();
    const evs = run(e, 60 * 6); // 60분
    expect(evs.length).toBeGreaterThan(0);
    expect(evs[0]).toMatchObject({ stationId: expect.any(String), from: expect.any(String), to: expect.any(String) });
    const st3 = e.snapshot().stations.find((s) => s.id === "st-3"); // imbalance
    expect(st3.transitions[0].to).toBe(STATES.DANGER); // 최신순
  });

  it("이력은 historyLimit까지만 보관, 통신 두절 구간은 이력에 없다", () => {
    const e = make({ historyLimit: 50 });
    run(e, 200);
    for (const s of e.snapshot().stations) expect(s.history.length).toBeLessThanOrEqual(50);
  });

  it("스냅샷은 매번 새 배열 (React 상태 갱신용)", () => {
    const e = make();
    e.step();
    const a = e.snapshot();
    e.step();
    const b = e.snapshot();
    expect(a.stations).not.toBe(b.stations);
    expect(a.stations[0].history).not.toBe(b.stations[0].history);
    expect(a.stations[0].history.length).toBe(1);
  });

  it("수거하면 위험 → 정상으로 돌아온다", () => {
    const e = make();
    run(e, 80 * 6); // st-1 gradual 80분 → 위험
    const get = () => e.snapshot().stations.find((s) => s.id === "st-1");
    expect(get().judgement.state).toBe(STATES.DANGER);
    e.collect("st-1");
    const evs = run(e, 6); // 1분
    expect(get().judgement.state).toBe(STATES.NORMAL);
    expect(evs.some((ev) => ev.stationId === "st-1" && ev.to === STATES.NORMAL)).toBe(true);
  });

  it("시나리오 변경 시 이력 초기화, 첫 샘플 즉시 판정", () => {
    const e = make();
    run(e, 30);
    e.setScenario("st-2", "collect");
    expect(e.snapshot().stations.find((s) => s.id === "st-2").history).toHaveLength(0);
    e.step();
    const st2 = e.snapshot().stations.find((s) => s.id === "st-2");
    expect(st2.scenarioId).toBe("collect");
    expect(st2.judgement.state).toBe(STATES.DANGER);
  });

  describe("실물 지점 (setRealStations / ingestReal)", () => {
    // 시뮬레이터 시계는 0부터 10초씩, 실제 시계는 따로 움직인다
    const WALL0 = 1_800_000_000_000;
    function makeLive() {
      let wall = WALL0;
      const e = createEngine({ sim: createSimulator({ seed: 1, startTs: 0 }), wallClock: () => wall });
      return { e, advanceWall: (ms) => (wall += ms), wall: () => wall };
    }
    const real = (ts, leftG, rightG = leftG) => ({ stationId: "st-1", ts, leftG, rightG, rainMm: 0, rssi: -60, batteryPct: 90 });
    const st1 = (e) => e.snapshot().stations.find((s) => s.id === "st-1");

    it("지정 직후 데이터가 없으면 점검 필요(수신 기록 없음), 실제 시계를 쓴다", () => {
      const { e } = makeLive();
      e.setRealStations(["st-1"]);
      const s = st1(e);
      expect(s.live).toBe(true);
      expect(s.clockNow).toBe(WALL0);
      expect(s.judgement.state).toBe(STATES.CHECK);
      expect(s.judgement.reason[0]).toContain("수신 기록 없음");
    });

    it("가상 샘플은 무시하고 서버 샘플로 판정, 다른 지점은 계속 가상", () => {
      const { e, wall } = makeLive();
      e.setRealStations(["st-1"]);
      e.ingestReal("st-1", [real(wall() - 20_000, 400), real(wall() - 10_000, 410)]);
      run(e, 30);
      const s = st1(e);
      expect(s.latest.leftG).toBe(410); // 시뮬레이터 값으로 덮이지 않음
      expect(s.history.every((x) => x.leftG >= 400)).toBe(true);
      expect(s.judgement.state).toBe(STATES.WARN); // 820g
      expect(e.snapshot().stations.find((x) => x.id === "st-2").history.length).toBeGreaterThan(0);
    });

    it("시뮬레이터 시계가 아무리 앞서가도 실물 지점은 실제 시계로 통신 두절 판정", () => {
      const { e, wall, advanceWall } = makeLive();
      e.setRealStations(["st-1"]);
      e.ingestReal("st-1", [real(wall(), 100)]);
      run(e, 600); // 시뮬레이터 100분 경과
      expect(st1(e).judgement.state).toBe(STATES.NORMAL); // 실제로는 거의 안 지났음
      advanceWall(6 * 60_000); // 실제 6분 무수신
      e.step();
      expect(st1(e).judgement.state).toBe(STATES.CHECK);
      expect(st1(e).judgement.checkCause).toBe("stale");
    });

    it("이미 반영한 시각 이전 샘플은 건너뛴다", () => {
      const { e, wall } = makeLive();
      e.setRealStations(["st-1"]);
      e.ingestReal("st-1", [real(wall(), 100)]);
      e.ingestReal("st-1", [real(wall() - 5000, 999)]);
      expect(st1(e).latest.leftG).toBe(100);
    });

    it("모드 전환 직후 첫 상태 전환은 알리지 않는다 (가상 복귀 포함)", () => {
      const { e, wall } = makeLive();
      e.setRealStations(["st-1"]);
      expect(e.ingestReal("st-1", [real(wall(), 100)])).toEqual([]); // 점검 → 정상, 알림 없음
      e.setRealStations([]);
      expect(st1(e).live).toBe(false);
      const evs = run(e, 3);
      expect(evs.filter((x) => x.stationId === "st-1")).toEqual([]);
      expect(st1(e).judgement.state).toBe(STATES.NORMAL);
    });

    it("지정되지 않은 지점의 ingestReal은 무시", () => {
      const { e, wall } = makeLive();
      expect(e.ingestReal("st-1", [real(wall(), 100)])).toEqual([]);
      expect(st1(e).latest).toBeNull();
    });
  });

  it("강우 수동 입력이 스냅샷과 플래그에 반영", () => {
    const e = make();
    e.setRain(20);
    e.step();
    const snap = e.snapshot();
    expect(snap.rainOverride).toBe(20);
    expect(snap.stations[0].judgement.flags).toContain("raining");
  });
});
