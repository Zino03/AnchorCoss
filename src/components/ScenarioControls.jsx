import { SCENARIOS } from "../sim/scenario.js";

const SPEEDS = [1, 5, 20];
const RAIN_MAX = 30;

/**
 * 시연 제어: 재생/일시정지 · 배속 · 한 틱 · 강우 수동 입력 · 선택 지점 시나리오/수거 · 처음부터
 * 시연 중 방해되지 않게 작게 한 줄로 (DESIGN.md 5장)
 */
export function ScenarioControls({ sim, selected }) {
  const manualRain = sim.rainOverride != null;

  return (
    <div className="controls" role="toolbar" aria-label="시연 제어">
      <div className="control-group">
        <button
          className="btn is-primary"
          onClick={() => sim.setPlaying(!sim.playing)}
          aria-label={sim.playing ? "일시정지" : "재생"}
        >
          {sim.playing ? "⏸ 일시정지" : "▶ 재생"}
        </button>
        <span className="btn-group" role="group" aria-label="배속">
          {SPEEDS.map((n) => (
            <button
              key={n}
              className={`btn${sim.speed === n ? " is-active" : ""}`}
              aria-pressed={sim.speed === n}
              onClick={() => sim.setSpeed(n)}
            >
              {n}×
            </button>
          ))}
        </span>
        {!sim.playing && (
          <button className="btn" onClick={sim.step} title="10초 진행">
            +10초
          </button>
        )}
      </div>

      <div className="control-group">
        <label className="control-check">
          <input
            type="checkbox"
            checked={manualRain}
            onChange={(e) => sim.setRain(e.target.checked ? 15 : null)}
          />
          강우 수동
        </label>
        <input
          type="range"
          min={0}
          max={RAIN_MAX}
          step={1}
          value={manualRain ? sim.rainOverride : 0}
          disabled={!manualRain}
          onChange={(e) => sim.setRain(Number(e.target.value))}
          aria-label="강우량 (mm/h)"
          className="control-range"
        />
        <span className="control-value num">{manualRain ? `${sim.rainOverride}mm/h` : "시나리오"}</span>
      </div>

      {selected && (
        <div className="control-group">
          <span className="control-label" title={selected.name}>
            {selected.name}
          </span>
          <select
            className="control-select"
            value={selected.scenarioId}
            onChange={(e) => sim.setScenario(selected.id, e.target.value)}
            aria-label={`${selected.name} 시나리오`}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => sim.collect(selected.id)}>
            수거(리셋)
          </button>
        </div>
      )}

      <button className="btn" onClick={sim.reset} title="모든 지점을 처음부터">
        처음부터
      </button>
    </div>
  );
}
