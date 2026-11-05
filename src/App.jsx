// 임시 확인 화면 — useSimulation 동작 확인용. 프론트 작업에서 DESIGN.md 기준 화면으로 교체한다.
import { useSimulation } from "./sim/useSimulation.js";
import { STATE_META, FLAG_LABEL } from "./logic/states.js";

export default function App() {
  const sim = useSimulation();

  return (
    <main style={{ padding: 16 }}>
      <h1>빗물받이 막힘 감지 대시보드 (임시 확인 화면)</h1>

      <p>
        {new Date(sim.now).toLocaleTimeString("ko-KR")}{" "}
        <button onClick={() => sim.setPlaying(!sim.playing)}>{sim.playing ? "일시정지" : "재생"}</button>{" "}
        {[1, 5, 20].map((n) => (
          <button key={n} onClick={() => sim.setSpeed(n)} disabled={sim.speed === n}>
            {n}×
          </button>
        ))}{" "}
        <button onClick={() => sim.setRain(sim.rainOverride == null ? 15 : null)}>
          강우 {sim.rainOverride == null ? "켜기(15mm/h)" : "끄기"}
        </button>{" "}
        <button onClick={sim.reset}>처음부터</button>
      </p>

      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>지점</th>
            <th>시나리오</th>
            <th>상태</th>
            <th>점수</th>
            <th>좌/우(g)</th>
            <th>플래그</th>
            <th>판정 근거</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sim.stations.map((s) => {
            const j = s.judgement;
            return (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.scenarioId}</td>
                <td>
                  {STATE_META[j.state].icon} {STATE_META[j.state].label}
                  {j.pending && ` (→ ${STATE_META[j.pending].label} 확인 중)`}
                </td>
                <td>{j.score ?? "—"}</td>
                <td>{s.latest ? `${s.latest.leftG} / ${s.latest.rightG}` : "—"}</td>
                <td>{j.flags.map((f) => FLAG_LABEL[f]).join(", ")}</td>
                <td>{j.reason.join(" / ")}</td>
                <td>
                  <button onClick={() => sim.collect(s.id)}>수거</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>최근 상태 전환</h2>
      <ul>
        {sim.events.slice(0, 10).map((ev) => (
          <li key={ev.id}>
            {new Date(ev.ts).toLocaleTimeString("ko-KR")} {ev.stationId}: {STATE_META[ev.from].label} →{" "}
            {STATE_META[ev.to].label} — {ev.reason}
          </li>
        ))}
      </ul>
    </main>
  );
}
