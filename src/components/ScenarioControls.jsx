import { useState } from "react";
import { WeatherInfo } from "./WeatherInfo.jsx";

const SPEEDS = [1, 5, 20];
const RAIN_MAX = 30;

/**
 * 시연 제어 (전체 지점에 적용): 재생/일시정지 · 배속 · 강우 모드(시뮬레이션/실시간) · 처음부터
 * 지점 하나를 조작하는 시나리오 변경·수거는 상세 패널(DrainDetail)에 있다.
 */
export function ScenarioControls({ sim, rainMode, onRainMode, weather }) {
  const manualRain = sim.rainOverride != null;
  const [lastRain, setLastRain] = useState(15); // 체크를 껐다 켜도 마지막 값 유지

  const setRain = (mm) => {
    setLastRain(mm);
    sim.setRain(mm);
  };

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
        {!sim.playing && (
          <button className="btn" onClick={sim.step} title="10초 진행">
            +10초
          </button>
        )}
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
      </div>

      <span className="control-sep" aria-hidden="true" />

      <div className="control-group">
        <span className="btn-group" role="group" aria-label="강우 데이터">
          <button
            className={`btn${rainMode === "sim" ? " is-active" : ""}`}
            aria-pressed={rainMode === "sim"}
            onClick={() => onRainMode("sim")}
            title="시나리오 강우 또는 수동 입력값 사용"
          >
            시뮬레이션
          </button>
          <button
            className={`btn${rainMode === "live" ? " is-active" : ""}`}
            aria-pressed={rainMode === "live"}
            onClick={() => onRainMode("live")}
            title="기상청 실측 강우를 모든 지점에 적용 (센서 값은 실물 연결 전까지 가상)"
          >
            실시간
          </button>
        </span>

        {rainMode === "live" ? (
          <WeatherInfo weather={weather} />
        ) : (
          <>
            <label className="control-check">
              <input
                type="checkbox"
                checked={manualRain}
                onChange={(e) => sim.setRain(e.target.checked ? lastRain : null)}
              />
              강우 수동
            </label>
            {manualRain && (
              <>
                <input
                  type="range"
                  min={0}
                  max={RAIN_MAX}
                  step={1}
                  value={sim.rainOverride}
                  onChange={(e) => setRain(Number(e.target.value))}
                  aria-label="강우량 (mm/h)"
                  className="control-range"
                />
                <span className="control-value num">{sim.rainOverride}mm/h</span>
              </>
            )}
          </>
        )}
      </div>

      <span className="control-sep" aria-hidden="true" />

      <button className="btn" onClick={sim.reset} title="모든 지점을 처음부터 다시">
        ↺ 처음부터
      </button>
    </div>
  );
}
