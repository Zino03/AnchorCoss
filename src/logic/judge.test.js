import { describe, it, expect } from "vitest";
import { createJudge, createBaseline, classify } from "./judge.js";
import { runScenario } from "./evaluate.js";
import { STATES, STATE_META, FLAGS, FLAG_LABEL, CHECK_CAUSE } from "./states.js";
import { SCENARIOS } from "../sim/scenario.js";
import { TH } from "../config.js";

const SEC = 1000;

/** 10초 간격으로 샘플을 넣는 도우미 */
function feeder(th = TH) {
  const j = createJudge(th);
  let now = 0;
  return {
    push(leftG, rightG, extra = {}) {
      const r = j.update({ now, sample: { stationId: "x", ts: now, leftG, rightG, rainMm: 0, rssi: -55, batteryPct: 90, ...extra } });
      now += 10 * SEC;
      return r;
    },
    skip() {
      const r = j.update({ now, sample: null });
      now += 10 * SEC;
      return r;
    },
    /** 같은 값을 n번 */
    repeat(n, leftG, rightG, extra) {
      let r;
      for (let i = 0; i < n; i++) r = this.push(leftG, rightG, extra);
      return r;
    },
  };
}

describe("states / config", () => {
  it("상태·플래그 모두 라벨이 있다", () => {
    for (const s of Object.values(STATES)) expect(STATE_META[s]?.label).toBeTruthy();
    for (const f of Object.values(FLAGS)) expect(FLAG_LABEL[f]).toBeTruthy();
  });

  it("임계값 순서가 올바르다", () => {
    expect(TH.WARN_TOTAL_G).toBeLessThan(TH.DANGER_TOTAL_G);
    expect(TH.DANGER_SIDE_G).toBeLessThan(TH.MAX_VALID_G);
    expect(TH.RECOVER_RATIO).toBeGreaterThan(0);
    expect(TH.RECOVER_RATIO).toBeLessThan(1);
  });
});

describe("classify (단순 임계값)", () => {
  it("총량·편측 기준", () => {
    expect(classify(100, 100)).toBe(STATES.NORMAL);
    expect(classify(300, 300)).toBe(STATES.WARN);
    expect(classify(800, 800)).toBe(STATES.DANGER);
    expect(classify(1000, 0)).toBe(STATES.DANGER);
    expect(classify(-1, 100)).toBe(STATES.CHECK);
    expect(classify(null, 100)).toBe(STATES.CHECK);
    expect(classify(6000, 0)).toBe(STATES.CHECK);
  });
});

describe("createJudge — 규칙", () => {
  it("첫 샘플은 즉시 확정", () => {
    const f = feeder();
    expect(f.push(800, 800).judgement.state).toBe(STATES.DANGER);
  });

  it("디바운싱: 새 상태는 30초 지속돼야 확정, 전환 이벤트는 한 번만", () => {
    const f = feeder();
    f.push(100, 100);
    const r = [1, 2, 3, 4].map(() => f.push(350, 350)); // 0, 10, 20, 30초
    expect(r.map((x) => x.judgement.state)).toEqual([STATES.NORMAL, STATES.NORMAL, STATES.NORMAL, STATES.WARN]);
    expect(r[0].judgement.pending).toBe(STATES.WARN);
    expect(r.filter((x) => x.transition)).toHaveLength(1);
    expect(r[3].transition).toMatchObject({ from: STATES.NORMAL, to: STATES.WARN });
    expect(f.push(350, 350).transition).toBeNull();
  });

  it("짧은 변동은 무시 (후보 취소)", () => {
    const f = feeder();
    f.push(100, 100);
    f.push(350, 350);
    f.push(100, 100);
    expect(f.repeat(3, 350, 350).judgement.state).toBe(STATES.NORMAL);
  });

  it("이상치 필터: 급변 1회는 무시, 2회 연속이면 인정", () => {
    const f = feeder();
    f.repeat(3, 100, 100);
    const spike = f.push(1100, 100); // +1000
    expect(spike.judgement.metrics.totalG).toBe(200);
    f.push(100, 100);
    expect(f.push(100, 100).judgement.metrics.totalG).toBe(200);

    f.push(900, 900); // +1600 → 무시
    expect(f.push(900, 900).judgement.metrics.totalG).toBe(1800); // 연속 → 인정
  });

  it("히스테리시스: 위험에서 내려오려면 기준 × 0.8 미만", () => {
    const f = feeder();
    f.push(800, 800); // 위험 확정
    expect(f.repeat(6, 650, 650).judgement.state).toBe(STATES.DANGER); // 1300 ≥ 1200 유지
    expect(f.repeat(6, 550, 550).judgement.state).toBe(STATES.WARN); // 1100 < 1200
    expect(f.repeat(6, 260, 260).judgement.state).toBe(STATES.WARN); // 520 ≥ 480 유지
    expect(f.repeat(6, 200, 200).judgement.state).toBe(STATES.NORMAL);
  });

  it("통신 두절: STALE_SEC 경과 시 즉시 점검 필요, 수신되면 즉시 복귀", () => {
    const f = feeder();
    f.repeat(3, 100, 100);
    let r;
    for (let i = 0; i < TH.STALE_SEC / 10; i++) r = f.skip();
    expect(r.judgement.state).toBe(STATES.CHECK);
    expect(r.judgement.checkCause).toBe(CHECK_CAUSE.STALE);
    expect(r.judgement.reason[0]).toContain("통신 두절");
    expect(r.judgement.score).toBeNull();
    const back = f.push(100, 100);
    expect(back.judgement.state).toBe(STATES.NORMAL);
    expect(back.transition).toMatchObject({ from: STATES.CHECK, to: STATES.NORMAL });
  });

  it("센서 이상: 디바운싱 후 점검 필요, 원인 문장", () => {
    const f = feeder();
    f.push(100, 100);
    expect(f.push(100, -300).judgement.state).toBe(STATES.NORMAL);
    const r = f.repeat(3, 100, -300);
    expect(r.judgement.state).toBe(STATES.CHECK);
    expect(r.judgement.checkCause).toBe(CHECK_CAUSE.SENSOR);
    expect(r.judgement.reason[0]).toBe("우측 로드셀 값 이상(-300g) — 센서 점검 필요");
    expect(f.repeat(4, 100, null).judgement.reason[0]).toContain("채널 누락");
  });

  it("편측 위험 + 편중 플래그 + 근거 문장", () => {
    const f = feeder();
    const { judgement: j } = f.push(1050, 60);
    expect(j.state).toBe(STATES.DANGER);
    expect(j.flags).toContain(FLAGS.IMBALANCE);
    expect(j.reason[0]).toBe("좌측 로드셀 1,050g — 편측 기준(1,000g) 초과");
    expect(j.reason.at(-1)).toContain("좌측에 95% 쏠림");
    expect(j.score).toBe(100);
  });

  it("우천·급증 플래그", () => {
    const f = feeder();
    let r;
    for (let i = 0; i < 30; i++) r = f.push(100 + i * 10, 100 + i * 10, { rainMm: 10 }); // 분당 120g
    expect(r.judgement.flags).toEqual(expect.arrayContaining([FLAGS.RAINING, FLAGS.FAST]));
    expect(r.judgement.reason[1]).toMatch(/^우천 중\(10mm\/h\) · 최근 10분간 분당 약 \d+g씩 증가$/);
  });

  it("막힘 점수: 총량·편측 비율 중 큰 값", () => {
    const f = feeder();
    expect(f.push(300, 300).judgement.score).toBe(40); // 600/1500
    expect(feeder().push(500, 0).judgement.score).toBe(50); // 500/1000
  });
});

describe("시나리오 검증 (기획서 4.7)", () => {
  const seeds = [1, 2, 3, 4, 5];
  const compress = (a) => a.filter((v, i) => i === 0 || v !== a[i - 1]);

  for (const sc of SCENARIOS) {
    describe(sc.id, () => {
      for (const seed of seeds) {
        it(`seed ${seed}: 상태 흐름·플래그·정확도`, () => {
          const { rows, summary } = runScenario(sc.id, { seed });
          expect(compress(rows.map((r) => r.judged))).toEqual(sc.expectStates);
          const seen = new Set(rows.flatMap((r) => r.judgement.flags));
          expect([...seen].sort()).toEqual([...sc.expectFlags].sort());
          expect(summary.accJudge).toBeGreaterThanOrEqual(0.95);
          expect(summary.changesJudge).toBeLessThanOrEqual(summary.changesBaseline);
        });
      }
    });
  }

  // 정확도는 디바운싱 지연(30초)만큼 단순 방식보다 1~2% 낮을 수 있다. 대신 오경보가 없어야 한다.
  it("제안 방식은 오경보 0, 단순 임계값은 오경보가 있다", () => {
    let j = 0, b = 0;
    for (const sc of SCENARIOS) {
      for (const seed of seeds) {
        const { summary } = runScenario(sc.id, { seed });
        j += summary.falseJudge;
        b += summary.falseBaseline;
      }
    }
    expect(j).toBe(0);
    expect(b).toBeGreaterThan(0);
  });

  it("baseline은 통신 두절 규칙만 공유", () => {
    const b = createBaseline();
    expect(b.update({ now: 0, sample: null })).toBe(STATES.CHECK);
  });
});
