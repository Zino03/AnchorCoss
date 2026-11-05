import { ScenarioControls } from "./ScenarioControls.jsx";

const fmtClock = (ts) =>
  new Date(ts).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

/** 상단바: 제목 · 시뮬레이션 시각 · 시연 제어(전체 적용) */
export function TopBar({ sim }) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>빗물받이 막힘 감지 대시보드</h1>
        <span className="topbar-clock num" title="시뮬레이션 시각">
          <span className={`live-dot${sim.playing ? " is-on" : ""}`} aria-hidden="true" />
          {fmtClock(sim.now)}
          {!sim.playing && <span className="muted"> · 일시정지</span>}
        </span>
      </div>
      <ScenarioControls sim={sim} />
    </header>
  );
}
