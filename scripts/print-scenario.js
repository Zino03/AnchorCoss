// 시나리오별 가상 데이터와 정답 상태를 표로 출력한다.
// 사용: npm run scenario            (전체, 5분 간격)
//       npm run scenario -- gradual (특정 시나리오)
//       npm run scenario -- gradual 1  (1분 간격)
// 3단계에서 판정 결과·정확도 비교 열을 추가한다.

import { createSimulator } from "../src/sim/simulator.js";
import { SCENARIOS, getScenario, truthAt } from "../src/sim/scenario.js";
import { STATE_META } from "../src/logic/states.js";

const [onlyId, everyArg] = process.argv.slice(2);
const everyMin = Number(everyArg) || 5;
const list = onlyId ? [getScenario(onlyId)] : SCENARIOS;

const cols = [
  ["t(분)", 6],
  ["좌(g)", 7],
  ["우(g)", 7],
  ["합계", 7],
  ["강우", 5],
  ["RSSI", 5],
  ["정답", 14],
];
const row = (vals) => vals.map((v, i) => String(v).padEnd(cols[i][1])).join(" ");
const fmt = (v) => (v == null ? "null" : v);

for (const sc of list) {
  const sim = createSimulator({
    stations: [{ id: "x", name: sc.name, lat: 0, lng: 0, real: false, scenarioId: sc.id }],
    startTs: 0,
    loop: false,
  });
  console.log(`\n■ ${sc.id} — ${sc.name}: ${sc.description}`);
  console.log(row(cols.map((c) => c[0])));

  const stepsPerRow = (everyMin * 60) / sim.stepSec;
  const total = (sc.durationMin * 60) / sim.stepSec;
  for (let i = 0; i < total; i++) {
    const t = sim.elapsedMin("x");
    const { sample: s } = sim.tick()[0];
    if (i % stepsPerRow !== 0) continue;
    const truth = STATE_META[truthAt(sc, t)].label;
    if (!s) {
      console.log(row([t.toFixed(1), "—", "—", "—", "—", "—", truth + " (수신 없음)"]));
      continue;
    }
    const sum = s.leftG != null && s.rightG != null ? s.leftG + s.rightG : "—";
    console.log(
      row([t.toFixed(1), fmt(s.leftG), fmt(s.rightG), sum, s.rainMm, s.rssi, truth]),
    );
  }
}
