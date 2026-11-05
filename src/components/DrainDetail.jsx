// 선택 지점 상세 (DESIGN.md 5장 DrainDetail)
// 머리: 이름·상태·플래그 / 위: 좌우 게이지 | 판정 근거 + 통신 상태 / 아래: 중량 그래프, 타임라인
import { StateBadge, FlagTags } from "./StateBadge.jsx";
import { LoadCellGauge } from "./LoadCellGauge.jsx";
import { WeightChart } from "./WeightChart.jsx";
import { CommStatus } from "./CommStatus.jsx";
import { Timeline } from "./Timeline.jsx";
import { SCENARIOS } from "../sim/scenario.js";

/** 근거 문장의 숫자(1,234g, 80%, 7분 등)를 굵게 */
function Emph({ text }) {
  const parts = text.split(/(\d[\d,]*(?:\.\d+)?(?:g|%|분|mm\/h)?)/);
  return parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));
}

export function DrainDetail({ station, now, onCollect, onScenario }) {
  if (!station) {
    return (
      <section className="card">
        <p className="muted">지도나 목록에서 지점을 선택하세요.</p>
      </section>
    );
  }
  const j = station.judgement;

  return (
    <section className={`card detail is-${j.state}`} aria-label={`${station.name} 상세`}>
      <div className="detail-head">
        <h2 className="detail-name">{station.name}</h2>
        <StateBadge state={j.state} pending={j.pending} pulse />
        <FlagTags flags={j.flags} />

        {/* 이 지점만 조작 (전체 제어는 상단바) */}
        {station.live && (
          <span className="tag is-live" title="서버에 수신된 실물 센서 데이터로 판정 중">
            실시간 수신
          </span>
        )}
        <div className="detail-actions">
          <label className="detail-scenario">
            <span className="muted">시나리오</span>
            <select
              className="control-select"
              value={station.scenarioId}
              onChange={(e) => onScenario(station.id, e.target.value)}
              aria-label={`${station.name} 시나리오`}
              disabled={station.live}
              title={station.live ? "실물 센서 지점은 시나리오가 없습니다" : undefined}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            onClick={() => onCollect(station.id)}
            disabled={station.live}
            title={station.live ? "실물 지점은 실제로 거름망을 비우면 반영됩니다" : "쌓인 쓰레기를 치운 것으로 처리"}
          >
            수거(리셋)
          </button>
        </div>
      </div>

      <div className="detail-top">
        <div className="detail-block">
          <h3 className="block-title">로드셀</h3>
          <LoadCellGauge sample={station.latest} metrics={j.metrics} state={j.state} flags={j.flags} />
        </div>

        <div className="detail-block detail-info">
          <div>
            <h3 className="block-title">
              판정 근거{j.score != null && <span className="muted"> · 막힘 점수 {j.score}</span>}
            </h3>
            <ul className="reason-list">
              {j.reason.map((r) => (
                <li key={r}>
                  <Emph text={r} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="block-title">통신 상태</h3>
            <CommStatus station={station} now={now} />
          </div>
        </div>
      </div>

      <div className="detail-block">
        <h3 className="block-title">중량 변화 (최근 1시간)</h3>
        <WeightChart history={station.history} transitions={station.transitions} />
      </div>

      <div className="detail-block">
        <h3 className="block-title">상태 전환 기록</h3>
        <Timeline transitions={station.transitions} />
      </div>
    </section>
  );
}
