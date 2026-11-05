// 시나리오별 가상 데이터·정답·판정 결과와 성능 비교표를 출력한다 (기획서 4.7).
// 사용: npm run scenario                 (전체 비교표만)
//       npm run scenario -- gradual      (특정 시나리오 상세, 5분 간격)
//       npm run scenario -- gradual 1    (1분 간격)
//       npm run scenario -- all          (전체 상세 + 비교표)

import { SCENARIOS, getScenario } from "../src/sim/scenario.js";
import { runScenario } from "../src/logic/evaluate.js";
import { STATE_META, FLAG_LABEL } from "../src/logic/states.js";

const [arg, everyArg] = process.argv.slice(2);
const everyMin = Number(everyArg) || 5;
const detail = arg ? (arg === "all" ? SCENARIOS : [getScenario(arg)]) : [];
const label = (s) => STATE_META[s].label;
const pad = (vals, widths) => vals.map((v, i) => String(v).padEnd(widths[i])).join(" ");

// 상세 표
const W = [6, 6, 6, 6, 5, 16, 16, 16, 20];
for (const sc of detail) {
  const { rows } = runScenario(sc.id);
  console.log(`\n■ ${sc.id} — ${sc.name}: ${sc.description}`);
  console.log(pad(["t(분)", "좌", "우", "합계", "강우", "정답", "판정", "단순", "플래그"], W));
  rows.forEach((r, i) => {
    const onRow = i % ((everyMin * 60) / 10) === 0;
    if (!onRow && !r.transition) return; // 전환 시점은 항상 출력
    const s = r.sample;
    const v = (x) => (x == null ? "null" : x);
    const sum = s && s.leftG != null && s.rightG != null ? s.leftG + s.rightG : "—";
    const judged = label(r.judged) + (r.transition ? " ◀" : "");
    console.log(
      pad(
        [
          r.t.toFixed(1),
          s ? v(s.leftG) : "—",
          s ? v(s.rightG) : "—",
          sum,
          s ? s.rainMm : "—",
          label(r.truth),
          judged,
          label(r.baseline),
          r.judgement.flags.map((f) => FLAG_LABEL[f]).join(","),
        ],
        W,
      ),
    );
  });
}

// 비교표 (seed 5개 평균)
const seeds = [1, 2, 3, 4, 5];
console.log("\n■ 판정 성능 비교 (seed 5개 평균) — 정확도 / 오경보(정답보다 많은 상태 전환)");
const CW = [14, 12, 12, 12, 12];
console.log(pad(["시나리오", "제안 정확도", "단순 정확도", "제안 오경보", "단순 오경보"], CW));
const tot = { aj: 0, ab: 0, fj: 0, fb: 0 };
for (const sc of SCENARIOS) {
  const ss = seeds.map((seed) => runScenario(sc.id, { seed }).summary);
  const avg = (k) => ss.reduce((a, s) => a + s[k], 0) / ss.length;
  const aj = avg("accJudge"), ab = avg("accBaseline"), fj = avg("falseJudge"), fb = avg("falseBaseline");
  Object.assign(tot, { aj: tot.aj + aj, ab: tot.ab + ab, fj: tot.fj + fj, fb: tot.fb + fb });
  console.log(pad([sc.id, `${(aj * 100).toFixed(1)}%`, `${(ab * 100).toFixed(1)}%`, fj.toFixed(1), fb.toFixed(1)], CW));
}
const n = SCENARIOS.length;
console.log(
  pad(["평균/합계", `${((tot.aj / n) * 100).toFixed(1)}%`, `${((tot.ab / n) * 100).toFixed(1)}%`, tot.fj.toFixed(1), tot.fb.toFixed(1)], CW),
);
console.log("※ 제안 방식은 30초 이동 중앙값 + 30초 디바운싱만큼 상태 전환을 늦게 잡습니다 (오경보를 없애는 대가로 생기는 의도된 지연).");
