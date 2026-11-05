// 시나리오를 처음부터 끝까지 돌려 판정 정확도를 잰다 (기획서 4.7).
// 제안 방식(createJudge)과 단순 임계값 방식(createBaseline)을 정답(truthAt)과 비교한다.

import { createSimulator } from "../sim/simulator.js";
import { getScenario, truthAt } from "../sim/scenario.js";
import { createJudge, createBaseline } from "./judge.js";
import { TH } from "../config.js";

const changes = (seq) => seq.reduce((n, v, i) => n + (i > 0 && v !== seq[i - 1] ? 1 : 0), 0);

export function runScenario(scenarioId, { seed = 1, th = TH } = {}) {
  const sc = getScenario(scenarioId);
  const sim = createSimulator({
    stations: [{ id: "x", name: sc.name, lat: 0, lng: 0, real: false, scenarioId }],
    startTs: 0,
    loop: false,
    seed,
  });
  const judge = createJudge(th);
  const baseline = createBaseline(th);

  const rows = [];
  const steps = (sc.durationMin * 60) / sim.stepSec;
  for (let i = 0; i < steps; i++) {
    const t = sim.elapsedMin("x");
    const { now, sample } = sim.tick()[0];
    const { judgement, transition } = judge.update({ now, sample });
    rows.push({
      t,
      sample,
      truth: truthAt(sc, t),
      judged: judgement.state,
      baseline: baseline.update({ now, sample }),
      judgement,
      transition,
    });
  }

  const n = rows.length;
  const acc = (key) => rows.filter((r) => r[key] === r.truth).length / n;
  const seq = (key) => rows.map((r) => r[key]);
  return {
    scenario: sc,
    rows,
    summary: {
      samples: n,
      accJudge: acc("judged"),
      accBaseline: acc("baseline"),
      changesTruth: changes(seq("truth")),
      changesJudge: changes(seq("judged")),
      changesBaseline: changes(seq("baseline")),
      // 오경보: 정답보다 많이 일어난 상태 전환 횟수
      falseJudge: Math.max(0, changes(seq("judged")) - changes(seq("truth"))),
      falseBaseline: Math.max(0, changes(seq("baseline")) - changes(seq("truth"))),
    },
  };
}
