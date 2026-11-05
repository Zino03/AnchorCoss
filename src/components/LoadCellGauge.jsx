// 좌/우 로드셀 게이지 (DESIGN.md 5장 LoadCellGauge) — 이 작품의 특징 화면
// 아치형(U자) 바닥 단면 안에서 좌/우 막대가 아래에서 위로 차오른다.
// 막대와 기준선은 같은 영역(.gauge-tracks) 기준이라 위치가 정확히 맞는다.
//
// 판정과 어긋나지 않게:
//  - 막대 높이는 판정이 쓰는 값(최근 30초 중앙값, judgement.metrics)으로 그린다 (노이즈로 흔들리지 않음)
//  - 막대 색은 지점의 판정 상태를 따르고, 한쪽이 편측 위험 기준(700g) 이상이면 그쪽만 빨강
//  - 기준선은 판정에 실제로 쓰는 "한쪽" 기준인 편측 위험선만 그린다 (합계 기준은 그래프에 표시)
//  - 센서 이상(음수·누락·범위 초과)은 가장 최근 원시 샘플로 판단해 빗금 + "이상"

import { TH } from "../config.js";
import { FLAGS, STATES } from "../logic/states.js";
import { fmtG } from "../ui/format.js";

const SCALE_MAX = TH.LOADCELL_MAX_G; // 눈금 최대 = 로드셀 정격(1kg)
const pct = (v) => `${Math.min(100, Math.max(0, (v / SCALE_MAX) * 100))}%`;
const valid = (v) => v != null && v >= 0 && v <= TH.MAX_VALID_G;

function fillState(value, stationState) {
  if (value >= TH.DANGER_SIDE_G) return STATES.DANGER;
  return [STATES.NORMAL, STATES.WARN, STATES.DANGER].includes(stationState) ? stationState : STATES.NORMAL;
}

function Track({ value, fault, stationState }) {
  if (fault) {
    return (
      <div className="gauge-track">
        <div className="gauge-fill st-check" style={{ height: "100%" }} />
        <span className="gauge-fault">이상</span>
      </div>
    );
  }
  return (
    <div className="gauge-track">
      <div className={`gauge-fill st-${fillState(value, stationState)}`} style={{ height: pct(value) }} />
      {value > SCALE_MAX && <span className="gauge-over">정격 초과</span>}
    </div>
  );
}

/**
 * @param {{ sample: object|null, metrics: object, state: string, flags: string[] }} props
 *   sample: 가장 최근 원시 샘플 (센서 이상 판단용), metrics: 판정의 평활값
 */
export function LoadCellGauge({ sample, metrics, state, flags }) {
  // 아직 수신한 샘플이 없을 때 (시나리오 변경 직후 등) — "이상"과 구분해서 표시
  if (!sample) return <p className="muted gauge-empty">수신 대기 중…</p>;

  const faultL = !valid(sample.leftG);
  const faultR = !valid(sample.rightG);
  // 판정 평활값이 있으면 그 값, 없으면 원시값
  const l = metrics?.leftG ?? sample.leftG;
  const r = metrics?.rightG ?? sample.rightG;
  const imbalance = flags.includes(FLAGS.IMBALANCE) && !faultL && !faultR;
  const heavy = imbalance ? (l >= r ? "left" : "right") : null;

  return (
    <div className="gauge" aria-label={`좌 ${faultL ? "이상" : fmtG(l)}, 우 ${faultR ? "이상" : fmtG(r)}`}>
      <div className="gauge-body">
        <div className="gauge-tracks">
          <div className="gauge-line is-danger" style={{ bottom: pct(TH.DANGER_SIDE_G) }}>
            <span>편측 위험 {fmtG(TH.DANGER_SIDE_G)}</span>
          </div>
          <Track value={l} fault={faultL} stationState={state} />
          <Track value={r} fault={faultR} stationState={state} />
        </div>
        <div className="gauge-labels">
          <span>좌{heavy === "left" && <em className="gauge-heavy">쏠림</em>}</span>
          <span>우{heavy === "right" && <em className="gauge-heavy">쏠림</em>}</span>
        </div>
      </div>
      <div className="gauge-values num">
        <span>
          좌 <b>{faultL ? "이상" : fmtG(l)}</b>
        </span>
        <span>
          우 <b>{faultR ? "이상" : fmtG(r)}</b>
        </span>
        <span>
          합계 <b>{faultL || faultR ? "—" : fmtG(l + r)}</b>
        </span>
      </div>
      <p className="gauge-note muted">눈금 최대 = 로드셀 정격 {fmtG(SCALE_MAX)} · 최근 {TH.SMOOTH_SEC}초 중앙값</p>
    </div>
  );
}
