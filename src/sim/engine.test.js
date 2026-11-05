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

  it("강우 수동 입력이 스냅샷과 플래그에 반영", () => {
    const e = make();
    e.setRain(20);
    e.step();
    const snap = e.snapshot();
    expect(snap.rainOverride).toBe(20);
    expect(snap.stations[0].judgement.flags).toContain("raining");
  });
});
