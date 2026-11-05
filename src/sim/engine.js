// 시뮬레이터 + 지점별 판정기를 묶어 화면용 데이터(Station[])를 만든다. React와 무관 (테스트 가능).
//
// 지점은 두 종류:
//  - 가상 지점: sim.tick()이 만든 샘플을 시뮬레이터 시계(sim.now, 실제보다 빠름)로 판정
//  - 실물 지점(setRealStations로 지정): 서버에서 받은 샘플을 ingestReal()로 넣고, **실제 시계(Date.now)**로 판정
//    → 두 시계를 섞으면 실물 지점이 항상 "통신 두절"로 보이는 문제가 생기므로 분리한다.
//    실물 지점이 지정된 동안 시뮬레이터가 그 지점에 만드는 가상 샘플은 무시한다.

import { createSimulator } from "./simulator.js";
import { createJudge } from "../logic/judge.js";
import { TH } from "../config.js";

/**
 * @param {Object} [opt]
 * @param {ReturnType<typeof createSimulator>} [opt.sim]
 * @param {typeof TH} [opt.th]
 * @param {number} [opt.historyLimit]    가상 지점 보관 샘플 수 (기본 360 = 10초 간격 1시간)
 * @param {number} [opt.realHistoryLimit] 실물 지점 보관 샘플 수 (기본 3600 = 1초 간격 1시간)
 * @param {number} [opt.transitionLimit] 지점별 보관 상태 전환 수
 * @param {() => number} [opt.wallClock] 실제 시계 (테스트에서 교체)
 */
export function createEngine({
  sim = createSimulator(),
  th = TH,
  historyLimit = 360,
  realHistoryLimit = 3600,
  transitionLimit = 20,
  wallClock = () => Date.now(),
} = {}) {
  const fresh = () => ({
    judge: createJudge(th),
    latest: null,
    history: [],
    judgement: null,
    transitions: [],
    quiet: false, // true면 다음 상태 전환 1회는 알리지 않음 (모드 전환 직후 잡음 방지)
  });
  const per = new Map(sim.stations().map((s) => [s.id, fresh()]));
  let realIds = new Set();

  /** 샘플(또는 수신 없음 null) 1건 반영. 상태 전환이 있으면 이벤트 반환 */
  function ingest(stationId, now, sample) {
    const p = per.get(stationId);
    const { judgement, transition } = p.judge.update({ now, sample });
    if (sample) {
      p.latest = sample;
      p.history.push(sample);
      const limit = realIds.has(stationId) ? realHistoryLimit : historyLimit;
      if (p.history.length > limit) p.history.splice(0, p.history.length - limit);
    }
    p.judgement = judgement;
    if (!transition) return null;
    if (p.quiet) {
      p.quiet = false;
      return null;
    }
    const ev = { id: `${stationId}-${transition.ts}`, stationId, ...transition };
    p.transitions.unshift(ev);
    if (p.transitions.length > transitionLimit) p.transitions.pop();
    return ev;
  }

  /** 지점 상태 초기화 (모드 전환·시나리오 변경) */
  function resetStation(id, now) {
    const keep = per.get(id).transitions; // 전환 기록은 남긴다
    const p = fresh();
    p.transitions = keep;
    p.quiet = true;
    per.set(id, p);
    ingest(id, now, null); // 판정값을 비워 두지 않기 위해 (데이터 없음 → 점검 필요)
  }

  return {
    /** 한 스텝 진행. 이번 스텝의 상태 전환 이벤트 목록 반환 */
    step() {
      const events = [];
      for (const { stationId, now, sample } of sim.tick()) {
        if (realIds.has(stationId)) continue; // 실물 지점은 가상 샘플을 쓰지 않음
        const ev = ingest(stationId, now, sample);
        if (ev) events.push(ev);
      }
      // 실물 지점: 실제 시계로 통신 두절 등을 다시 판정
      const wall = wallClock();
      for (const id of realIds) {
        const ev = ingest(id, wall, null);
        if (ev) events.push(ev);
      }
      return events;
    },

    /**
     * 실물 지점 지정. 빈 배열이면 모두 가상으로.
     * 바뀐 지점은 판정·이력을 초기화한다 (실물은 서버 이력으로 다시 채워짐).
     */
    setRealStations(ids) {
      const next = new Set(ids.filter((id) => per.has(id)));
      for (const id of new Set([...realIds, ...next])) {
        if (realIds.has(id) !== next.has(id)) resetStation(id, next.has(id) ? wallClock() : sim.now);
      }
      realIds = next;
    },

    /**
     * 서버에서 받은 실물 샘플 반영 (측정 시각순). 이미 반영한 시각 이전 샘플은 판정에서 건너뛴다.
     * @returns {object[]} 상태 전환 이벤트
     */
    ingestReal(stationId, samples) {
      if (!realIds.has(stationId)) return [];
      const p = per.get(stationId);
      const events = [];
      for (const s of [...samples].sort((a, b) => a.ts - b.ts)) {
        if (p.latest && s.ts <= p.latest.ts) continue;
        const ev = ingest(stationId, s.ts, s); // 측정 시각 기준으로 판정 (디바운싱 시간 계산이 맞도록)
        if (ev) events.push(ev);
      }
      // 마지막으로 현재 시각 기준 재판정 (오래된 이력만 받은 경우 통신 두절 반영)
      const ev = ingest(stationId, wallClock(), null);
      if (ev) events.push(ev);
      return events;
    },

    /** 화면용 스냅샷 (매번 새 배열 → React 상태로 그대로 사용) */
    snapshot() {
      const wall = wallClock();
      return {
        now: sim.now,
        rainOverride: sim.rainOverride,
        stations: sim.stations().map((s) => {
          const p = per.get(s.id);
          const live = realIds.has(s.id);
          return {
            ...s,
            live, // 실물 데이터 수신 중인 지점
            clockNow: live ? wall : sim.now, // "N분 전" 계산에 쓸 시계
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

    /** 시나리오 변경: 해당 지점의 판정기·그래프 이력도 초기화 (실물 지점은 무시) */
    setScenario(id, scenarioId) {
      sim.setScenario(id, scenarioId);
      if (realIds.has(id)) return;
      const p = per.get(id);
      p.judge = createJudge(th);
      p.history = [];
      p.latest = null;
    },
  };
}
