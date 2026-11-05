import { describe, it, expect } from "vitest";
import { createSimulator, DEFAULT_STATIONS } from "./simulator.js";
import { SCENARIOS, truthAt, getScenario } from "./scenario.js";

const one = (scenarioId, opt = {}) =>
  createSimulator({
    stations: [{ id: "x", name: "x", lat: 0, lng: 0, real: false, scenarioId }],
    startTs: 0,
    loop: false,
    ...opt,
  });

/** 연속 중복 제거 */
const compress = (arr) => arr.filter((v, i) => i === 0 || v !== arr[i - 1]);

describe("scenario 정의", () => {
  it("시나리오 8종, 기본 지점마다 하나씩 배정", () => {
    expect(SCENARIOS).toHaveLength(8);
    const used = new Set(DEFAULT_STATIONS.map((s) => s.scenarioId));
    for (const s of SCENARIOS) expect(used.has(s.id)).toBe(true);
  });

  for (const sc of SCENARIOS) {
    it(`${sc.id}: 정답 상태 흐름이 expectStates와 일치`, () => {
      const seq = [];
      for (let sec = 0; sec < sc.durationMin * 60; sec += 10) seq.push(truthAt(sc, sec / 60));
      expect(compress(seq)).toEqual(sc.expectStates);
    });
  }
});

describe("simulator", () => {
  it("같은 seed면 같은 데이터", () => {
    const a = createSimulator({ seed: 7, startTs: 0 });
    const b = createSimulator({ seed: 7, startTs: 0 });
    for (let i = 0; i < 50; i++) expect(a.tick()).toEqual(b.tick());
  });

  it("tick마다 stepSec만큼 시간이 흐르고 모든 지점이 나온다", () => {
    const sim = createSimulator({ startTs: 1000, stepSec: 10 });
    const r1 = sim.tick();
    const r2 = sim.tick();
    expect(r1).toHaveLength(DEFAULT_STATIONS.length);
    expect(r1[0].now).toBe(1000);
    expect(r2[0].now).toBe(11000);
    expect(r1[0].sample).toMatchObject({ stationId: "st-1", ts: 1000 });
  });

  it("통신 두절 구간은 sample이 null", () => {
    const sim = one("commDrop");
    const got = [];
    for (let sec = 0; sec < 50 * 60; sec += 10) got.push([sec / 60, sim.tick()[0].sample]);
    for (const [t, s] of got) {
      if (t >= 20 && t < 35) expect(s).toBeNull();
      else expect(s).not.toBeNull();
    }
  });

  it("센서 이상: 음수와 채널 누락(null)이 그대로 전달", () => {
    const sim = one("sensorFault");
    const byMin = {};
    for (let sec = 0; sec < 50 * 60; sec += 10) byMin[sec / 60] = sim.tick()[0].sample;
    expect(byMin[20].rightG).toBe(-350);
    expect(byMin[37].rightG).toBeNull();
    expect(byMin[45].rightG).toBeGreaterThan(0);
  });

  it("수거(collect) 후 중량이 0 근처로 떨어진다", () => {
    const sim = one("gradual");
    for (let i = 0; i < 80 * 6; i++) sim.tick(); // 80분
    const before = sim.tick()[0].sample;
    expect(before.leftG + before.rightG).toBeGreaterThan(1500);
    sim.collect("x");
    const after = sim.tick()[0].sample;
    expect(after.leftG + after.rightG).toBeLessThan(100);
  });

  it("강우 수동 입력이 시나리오 값을 덮어쓴다", () => {
    const sim = one("normal");
    expect(sim.tick()[0].sample.rainMm).toBe(0);
    sim.setRain(12);
    expect(sim.tick()[0].sample.rainMm).toBe(12);
    sim.setRain(null);
    expect(sim.tick()[0].sample.rainMm).toBe(0);
  });

  it("loop면 시나리오가 끝난 뒤 처음부터 반복", () => {
    const sim = one("collect", { loop: true });
    const steps = (getScenario("collect").durationMin * 60) / 10;
    for (let i = 0; i < steps; i++) sim.tick();
    sim.tick();
    expect(sim.elapsedMin("x")).toBeCloseTo(10 / 60);
  });

  it("setScenario는 처음부터 재생", () => {
    const sim = one("normal");
    for (let i = 0; i < 30; i++) sim.tick();
    sim.setScenario("x", "collect");
    expect(sim.elapsedMin("x")).toBe(0);
    const s = sim.tick()[0].sample;
    expect(s.leftG + s.rightG).toBeGreaterThan(1500);
  });
});
