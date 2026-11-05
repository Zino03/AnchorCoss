// 시뮬레이터 + 지점별 판정기를 묶어 화면용 데이터(Station[])를 만든다. React와 무관 (테스트 가능).
// 실물 센서를 붙일 때는 sim.tick() 대신 수신 샘플을 같은 경로(ingest)로 넣으면 된다.

import { createSimulator } from "./simulator.js";
import { createJudge } from "../logic/judge.js";
import { TH } from "../config.js";

/**
 * @param {Object} [opt]
 * @param {ReturnType<typeof createSimulator>} [opt.sim]
 * @param {typeof TH} [opt.th]
 * @param {number} [opt.historyLimit]    지점별 보관 샘플 수 (기본 360 = 10초 간격 1시간)
 * @param {number} [opt.transitionLimit] 지점별 보관 상태 전환 수
 */
export function createEngine({
  sim = createSimulator(),
  th = TH,
  historyLimit = 360,
  transitionLimit = 20,
} = {}) {
  const per = new Map(
    sim.stations().map((s) => [
      s.id,
      { judge: createJudge(th), latest: null, history: [], judgement: null, transitions: [] },
    ]),
  );

  /** 샘플(또는 수신 없음 null) 1건 반영. 상태 전환이 있으면 이벤트 반환 */
  function ingest(stationId, now, sample) {
    const p = per.get(stationId);
    const { judgement, transition } = p.judge.update({ now, sample });
    if (sample) {
      p.latest = sample;
      p.history.push(sample);
      if (p.history.length > historyLimit) p.history.shift();
    }
    p.judgement = judgement;
    if (!transition) return null;
    const ev = { id: `${stationId}-${transition.ts}`, stationId, ...transition };
    p.transitions.unshift(ev);
    if (p.transitions.length > transitionLimit) p.transitions.pop();
    return ev;
  }

  return {
    /** 한 스텝 진행. 이번 스텝의 상태 전환 이벤트 목록 반환 */
    step() {
      const events = [];
      for (const { stationId, now, sample } of sim.tick()) {
        const ev = ingest(stationId, now, sample);
        if (ev) events.push(ev);
      }
      return events;
    },

    /** 화면용 스냅샷 (매번 새 배열 → React 상태로 그대로 사용) */
    snapshot() {
      return {
        now: sim.now,
        rainOverride: sim.rainOverride,
        stations: sim.stations().map((s) => {
          const p = per.get(s.id);
          return {
            ...s,
            latest: p.latest,
            history: p.history.slice(),
            judgement: p.judgement,
            transitions: p.transitions.slice(),
          };
        }),
      };
    },

    collect: (id) => sim.collect(id),
    setRain: (mm) => sim.setRain(mm),

    /** 시나리오 변경: 해당 지점의 판정기·그래프 이력도 초기화 */
    setScenario(id, scenarioId) {
      sim.setScenario(id, scenarioId);
      const p = per.get(id);
      p.judge = createJudge(th);
      p.history = [];
      p.latest = null;
    },
  };
}
