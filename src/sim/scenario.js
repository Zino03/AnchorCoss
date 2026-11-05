// 가상 시나리오 정의 (기획서 5장).
// at(tMin): 노이즈 없는 기준값을 돌려준다. 노이즈는 simulator.js가 더한다.
// truth(tMin): 그 시각의 정답 상태 (ground truth). 판정 정확도 측정에 쓴다 (기획서 4.7).
// expectStates / expectFlags: 판정 로직이 보여야 하는 상태 흐름·플래그 (3단계 테스트용).

import { TH } from "../config.js";
import { STATES, FLAGS } from "../logic/states.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, x) => a + (b - a) * clamp01(x);

/** 디바운싱·히스테리시스 없이 임계값만으로 본 "이상적인" 상태 */
export function truthFromWeights(leftG, rightG) {
  const bad = (v) => v == null || v < 0 || v > TH.MAX_VALID_G;
  if (bad(leftG) || bad(rightG)) return STATES.CHECK;
  const total = leftG + rightG;
  const side = Math.max(leftG, rightG);
  if (total >= TH.DANGER_TOTAL_G || side >= TH.DANGER_SIDE_G) return STATES.DANGER;
  if (total >= TH.WARN_TOTAL_G) return STATES.WARN;
  return STATES.NORMAL;
}

/** 총량과 좌측 비율로 좌/우 값을 만든다 */
const split = (total, leftRatio = 0.5) => ({
  leftG: total * leftRatio,
  rightG: total * (1 - leftRatio),
});

export const SCENARIOS = [
  {
    id: "normal",
    name: "정상",
    description: "낮은 값 유지, 소폭 변동",
    durationMin: 60,
    at: (t) => ({
      leftG: 60 + 20 * Math.sin(t / 7),
      rightG: 50 + 15 * Math.cos(t / 9),
      rainMm: 0,
    }),
    expectStates: [STATES.NORMAL],
    expectFlags: [],
  },
  {
    id: "gradual",
    name: "서서히 누적",
    description: "좌우 균등하게 선형 증가 → 주의 → 위험(총량)",
    durationMin: 100,
    at: (t) => ({ ...split(lerp(100, 2000, t / 90)), rainMm: 0 }),
    expectStates: [STATES.NORMAL, STATES.WARN, STATES.DANGER],
    expectFlags: [],
  },
  {
    id: "imbalance",
    name: "한쪽 쏠림",
    description: "좌측만 빠르게 증가 → 위험(편측) + 편중",
    durationMin: 70,
    at: (t) => ({ leftG: lerp(50, 1300, t / 60), rightG: 60, rainMm: 0 }),
    expectStates: [STATES.NORMAL, STATES.WARN, STATES.DANGER],
    expectFlags: [FLAGS.IMBALANCE],
  },
  {
    id: "rainSurge",
    name: "우천 급증",
    description: "10~40분 강우(15mm/h) 동안 분당 80g씩 증가",
    durationMin: 55,
    at: (t) => {
      const raining = t >= 10 && t < 40;
      const total = t < 10 ? 200 : 200 + 80 * (Math.min(t, 40) - 10);
      return { ...split(total, 0.55), rainMm: raining ? 15 : 0 };
    },
    expectStates: [STATES.NORMAL, STATES.WARN, STATES.DANGER],
    expectFlags: [FLAGS.RAINING, FLAGS.FAST],
  },
  {
    id: "collect",
    name: "수거 후 복구",
    description: "위험 상태에서 20분에 수거 → 정상 복귀",
    durationMin: 40,
    at: (t) => {
      const total = t < 20 ? lerp(1600, 1800, t / 20) : 60 + (t - 20) * 2;
      return { ...split(total), rainMm: 0 };
    },
    expectStates: [STATES.DANGER, STATES.NORMAL],
    expectFlags: [],
  },
  {
    id: "commDrop",
    name: "통신 두절",
    description: "12분부터 신호 약화, 20~35분 수신 없음 → 점검 필요 → 복귀",
    durationMin: 50,
    at: (t) => {
      let rssi = -55;
      if (t >= 12 && t < 20) rssi = lerp(-55, -92, (t - 12) / 8);
      else if (t >= 35) rssi = -60;
      return { leftG: 170, rightG: 150, rainMm: 0, rssi, dropped: t >= 20 && t < 35 };
    },
    // 마지막 수신(20분) 후 STALE_SEC(5분)이 지나야 점검 필요
    truth: (t) =>
      t >= 20 + TH.STALE_SEC / 60 && t < 35 ? STATES.CHECK : STATES.NORMAL,
    expectStates: [STATES.NORMAL, STATES.CHECK, STATES.NORMAL],
    expectFlags: [],
  },
  {
    id: "sensorFault",
    name: "센서 이상",
    description: "15~30분 우측 음수값, 35~40분 우측 채널 누락",
    durationMin: 50,
    at: (t) => {
      let rightG = 180;
      if (t >= 15 && t < 30) rightG = -350;
      else if (t >= 35 && t < 40) rightG = null;
      return { leftG: 200, rightG, rainMm: 0 };
    },
    expectStates: [STATES.NORMAL, STATES.CHECK, STATES.NORMAL, STATES.CHECK, STATES.NORMAL],
    expectFlags: [],
  },
  {
    id: "spike",
    name: "노이즈/충격",
    description: "10분 +950g, 20·30분 +700g 순간 스파이크 (샘플 1개)",
    durationMin: 40,
    at: (t) => {
      // 샘플 1개(10초)만 걸리도록 0.1분 폭
      const hit = (m) => t >= m && t < m + 0.1;
      let bump = 0;
      if (hit(10)) bump = 950; // MAX_JUMP_G 초과 → 이상치 필터 확인
      if (hit(20) || hit(30)) bump = 700; // 필터 미만 → 디바운싱 확인
      return { leftG: 160 + bump, rightG: 140, rainMm: 0 };
    },
    truth: () => STATES.NORMAL,
    expectStates: [STATES.NORMAL],
    expectFlags: [],
  },
];

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);

export function getScenario(id) {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario: ${id}`);
  return s;
}

/** 시나리오의 tMin 시각 정답 상태 */
export function truthAt(scenario, tMin) {
  if (scenario.truth) return scenario.truth(tMin);
  const p = scenario.at(tMin);
  return truthFromWeights(p.leftG, p.rightG);
}
