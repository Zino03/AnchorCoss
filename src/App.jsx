// 임시 확인 화면 — F1 공통 스타일 확인용. F2에서 레이아웃으로 교체한다.
import { useSimulation } from "./sim/useSimulation.js";
import { STATE_META } from "./logic/states.js";
import { StateBadge, FlagTags } from "./components/StateBadge.jsx";

export default function App() {
  const sim = useSimulation();

  return (
    <main style={{ padding: "var(--sp-5)", display: "grid", gap: "var(--sp-4)" }}>
      <h1 style={{ fontSize: "var(--fs-title)" }}>빗물받이 막힘 감지 대시보드 (임시 확인 화면)</h1>

      <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
        <span className="num">{new Date(sim.now).toLocaleTimeString("ko-KR")}</span>
        <button className="btn is-primary" onClick={() => sim.setPlaying(!sim.playing)}>
          {sim.playing ? "일시정지" : "재생"}
        </button>
        <span className="btn-group">
          {[1, 5, 20].map((n) => (
            <button key={n} className={`btn${sim.speed === n ? " is-active" : ""}`} onClick={() => sim.setSpeed(n)}>
              {n}×
            </button>
          ))}
        </span>
        <button className="btn" onClick={() => sim.setRain(sim.rainOverride == null ? 15 : null)}>
          강우 {sim.rainOverride == null ? "켜기(15mm/h)" : "끄기"}
        </button>
        <button className="btn" onClick={sim.reset}>
          처음부터
        </button>
      </div>

      {/* 상태별 카드 스타일 확인 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--sp-4)" }}>
        {Object.keys(STATE_META).map((st) => (
          <div key={st} className={`card is-${st}`}>
            <div className="card-title">카드 · {STATE_META[st].label}</div>
            <StateBadge state={st} pulse />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">지점 목록</div>
        <table className="tmp-table">
          <thead>
            <tr>
              <th>지점</th>
              <th>시나리오</th>
              <th>상태</th>
              <th>점수</th>
              <th>좌/우(g)</th>
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
                  <td className="muted">{s.scenarioId}</td>
                  <td>
                    <StateBadge state={j.state} pending={j.pending} pulse />{" "}
                    <FlagTags flags={j.flags} />
                  </td>
                  <td className={`num tx-${j.state}`}>{j.score ?? "—"}</td>
                  <td className="num">{s.latest ? `${s.latest.leftG} / ${s.latest.rightG}` : "—"}</td>
                  <td>{j.reason.join(" / ")}</td>
                  <td>
                    <button className="btn" onClick={() => sim.collect(s.id)}>
                      수거
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
