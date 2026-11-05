// 좌/우 로드셀 게이지 (DESIGN.md 5장 LoadCellGauge) — 이 작품의 특징 화면
// 아치형(U자) 바닥 단면 안에서 좌/우 막대가 아래에서 위로 차오른다.
// 막대와 기준선은 같은 영역(.gauge-tracks) 기준이라 위치가 정확히 맞는다.

import { TH } from "../config.js";
import { FLAGS } from "../logic/states.js";
import { fmtG } from "../ui/format.js";

const SCALE_MAX = TH.DANGER_SIDE_G * 1.25; // 위험 기준 위로 여유
const SIDE_WARN = TH.WARN_TOTAL_G / 2; // 한쪽 기준으로 본 주의선 (합계 주의 기준의 절반)
const pct = (v) => `${Math.min(100, (v / SCALE_MAX) * 100)}%`;
const ok = (v) => v != null && v >= 0 && v <= TH.MAX_VALID_G;

function sideState(v) {
  if (!ok(v)) return "check";
  if (v >= TH.DANGER_SIDE_G) return "danger";
  if (v >= SIDE_WARN) return "warn";
  return "normal";
}

function Track({ value }) {
  const st = sideState(value);
  const fault = st === "check";
  return (
    <div className="gauge-track">
      <div className={`gauge-fill st-${st}`} style={{ height: fault ? "100%" : pct(value) }} />
      {fault && <span className="gauge-fault">이상</span>}
    </div>
  );
}

export function LoadCellGauge({ sample, flags }) {
  // 아직 수신한 샘플이 없을 때 (시나리오 변경 직후 등) — "이상"과 구분해서 표시
  if (!sample) return <p className="muted gauge-empty">수신 대기 중…</p>;

  const l = sample?.leftG ?? null;
  const r = sample?.rightG ?? null;
  const imbalance = flags.includes(FLAGS.IMBALANCE) && ok(l) && ok(r);
  const heavy = imbalance ? (l >= r ? "left" : "right") : null;

  return (
    <div className="gauge" aria-label={`좌 ${fmtG(l)}, 우 ${fmtG(r)}`}>
      <div className="gauge-body">
        <div className="gauge-tracks">
          <div className="gauge-line is-danger" style={{ bottom: pct(TH.DANGER_SIDE_G) }}>
            <span>위험 {fmtG(TH.DANGER_SIDE_G)}</span>
          </div>
          <div className="gauge-line is-warn" style={{ bottom: pct(SIDE_WARN) }}>
            <span>주의 {fmtG(SIDE_WARN)}</span>
          </div>
          <Track value={l} />
          <Track value={r} />
        </div>
        <div className="gauge-labels">
          <span>좌{heavy === "left" && <em className="gauge-heavy">쏠림</em>}</span>
          <span>우{heavy === "right" && <em className="gauge-heavy">쏠림</em>}</span>
        </div>
      </div>
      <div className="gauge-values num">
        <span>
          좌 <b>{ok(l) ? fmtG(l) : "이상"}</b>
        </span>
        <span>
          우 <b>{ok(r) ? fmtG(r) : "이상"}</b>
        </span>
        <span>
          합계 <b>{ok(l) && ok(r) ? fmtG(l + r) : "—"}</b>
        </span>
      </div>
    </div>
  );
}
