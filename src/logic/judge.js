// 판정 로직 (기획서 4장). 지점마다 createJudge()를 하나씩 만들고, 샘플이 올 때마다 update()를 호출한다.
//
// 처리 순서
//  1. 센서 이상 검사 (음수 / 최대값 초과 / 채널 누락) → 점검 필요(sensor)
//  2. 이상치 필터: 직전 채택값 대비 MAX_JUMP_G 넘게 변하면 1회 무시, 2회 연속이면 인정
//  3. 통신 두절: 마지막 수신 후 STALE_SEC 경과 → 점검 필요(stale), 즉시 확정
//  4. 중량 단계 판정 + 히스테리시스 (내려갈 때는 기준값 × RECOVER_RATIO 미만이어야 함)
//     판정에 쓰는 좌/우 값은 최근 SMOOTH_SEC초 채택값의 채널별 중앙값 (노이즈·순간 충격 완화, 시간 기준이라 샘플 간격과 무관)
//  5. 디바운싱: 새 상태가 DEBOUNCE_SEC 이상 지속돼야 확정
//     예외(즉시) — 첫 판정, 통신 두절 진입, 점검 필요에서 "점검 전과 같은 단계"로 복귀
//     (점검 전과 다른 단계로 복귀하면 디바운싱: 복구 직후 샘플 1~2개의 노이즈로 오경보가 나지 않게)
//  6. 플래그(우천/급증/편중), 막힘 점수, 판정 근거 문장 생성
//  7. 확정 상태가 바뀌면 transition 이벤트 반환 (알림은 이때만)

import { TH as DEFAULT_TH } from "../config.js";
import { STATES, STATE_META, FLAGS, CHECK_CAUSE } from "./states.js";

const fmtG = (v) => `${Math.round(v).toLocaleString("ko-KR")}g`;
const sideName = (isLeft) => (isLeft ? "좌" : "우");

/** 디바운싱·히스테리시스 없는 단순 임계값 분류 (비교 기준용) */
export function classify(leftG, rightG, th = DEFAULT_TH) {
  if (sensorFault({ leftG, rightG }, th)) return STATES.CHECK;
  const total = leftG + rightG;
  const side = Math.max(leftG, rightG);
  if (total >= th.DANGER_TOTAL_G || side >= th.DANGER_SIDE_G) return STATES.DANGER;
  if (total >= th.WARN_TOTAL_G) return STATES.WARN;
  return STATES.NORMAL;
}

/** 센서 이상이면 { isLeft, value } 반환, 정상이면 null */
function sensorFault(sample, th) {
  for (const [isLeft, v] of [[true, sample.leftG], [false, sample.rightG]]) {
    if (v == null || v < 0 || v > th.MAX_VALID_G) return { isLeft, value: v };
  }
  return null;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 최소제곱 기울기 (g/분). 데이터 구간이 minSpanMin분 미만이면 null (짧은 구간은 노이즈에 크게 흔들림) */
function slopePerMin(points, minSpanMin) {
  if (points.length < 3) return null;
  const t0 = points[0].ts;
  const span = (points[points.length - 1].ts - t0) / 60000;
  if (span < minSpanMin) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of points) {
    const x = (p.ts - t0) / 60000;
    sx += x; sy += p.total; sxx += x * x; sxy += x * p.total;
  }
  const n = points.length;
  const den = n * sxx - sx * sx;
  return den === 0 ? null : (n * sxy - sx * sy) / den;
}

/** 하드웨어 수거 단계: 0(1단계 미만) / 1(≥주의) / 2(≥중간) / 3(≥위험) — 표시용 */
export function stageOf(totalG, th = DEFAULT_TH) {
  if (totalG >= th.DANGER_TOTAL_G) return 3;
  if (totalG >= th.MID_TOTAL_G) return 2;
  if (totalG >= th.WARN_TOTAL_G) return 1;
  return 0;
}

/** 히스테리시스를 적용한 중량 단계. levelRank: 직전 확정 단계 (0 정상, 1 주의, 2 위험) */
function weightLevel(total, side, levelRank, th) {
  const r = th.RECOVER_RATIO;
  const dangerOn = total >= th.DANGER_TOTAL_G || side >= th.DANGER_SIDE_G;
  const dangerHold = levelRank >= 2 && (total >= th.DANGER_TOTAL_G * r || side >= th.DANGER_SIDE_G * r);
  if (dangerOn || dangerHold) return STATES.DANGER;
  const warnOn = total >= th.WARN_TOTAL_G;
  const warnHold = levelRank >= 1 && total >= th.WARN_TOTAL_G * r;
  if (warnOn || warnHold) return STATES.WARN;
  return STATES.NORMAL;
}

/**
 * 지점 하나의 판정기.
 * @param {typeof DEFAULT_TH} [th]
 */
export function createJudge(th = DEFAULT_TH) {
  let confirmed = null; // 확정 상태
  let checkCause = null; // 확정 상태가 점검 필요일 때 원인
  let lastLevel = STATES.NORMAL; // 마지막 확정 중량 단계 (점검 필요 복귀 시 히스테리시스용)
  let candidate = null; // 디바운싱 중인 후보 상태
  let candidateSince = null;

  let lastTs = null; // 마지막 수신 시각
  let lastSample = null; // 마지막 수신 샘플 (이상값 포함)
  let lastWasFault = false;
  let accepted = null; // 필터를 통과한 최신 값 { leftG, rightG, ts }
  let jumpPending = false;
  let history = []; // 증가 속도 계산용 { ts, total }
  let recent = []; // 판정용 최근 SMOOTH_SEC초 채택값 { ts, leftG, rightG } (채널별 중앙값)

  function accept(sample) {
    const total = sample.leftG + sample.rightG;
    if (accepted && !jumpPending) {
      const prev = accepted.leftG + accepted.rightG;
      if (Math.abs(total - prev) > th.MAX_JUMP_G) {
        jumpPending = true; // 1회는 무시
        return;
      }
    }
    jumpPending = false;
    accepted = { leftG: sample.leftG, rightG: sample.rightG, ts: sample.ts };
    history.push({ ts: sample.ts, total });
    recent.push({ ts: sample.ts, leftG: sample.leftG, rightG: sample.rightG });
    const smoothFrom = sample.ts - th.SMOOTH_SEC * 1000;
    while (recent.length > 1 && recent[0].ts < smoothFrom) recent.shift();
    const from = sample.ts - th.RATE_WINDOW_MIN * 60000;
    while (history.length && history[0].ts < from) history.shift();
  }

  function metrics() {
    if (!accepted) {
      return { leftG: null, rightG: null, totalG: null, maxSideG: null, imbalance: null, rateGPerMin: null, stage: null };
    }
    const leftG = median(recent.map((r) => r.leftG));
    const rightG = median(recent.map((r) => r.rightG));
    const totalG = leftG + rightG;
    return {
      leftG,
      rightG,
      totalG,
      maxSideG: Math.max(leftG, rightG),
      imbalance: totalG >= th.IMBALANCE_MIN_G ? Math.abs(leftG - rightG) / totalG : null,
      rateGPerMin: slopePerMin(history, th.RATE_MIN_SPAN_MIN),
      stage: stageOf(totalG, th),
    };
  }

  /**
   * @param {{ now: number, sample: import("./types.js").Sample|null }} input
   * @returns {{ judgement: import("./types.js").Judgement, transition: null|{ts:number, from:string, to:string, reason:string} }}
   */
  function update({ now, sample }) {
    let raw;
    let rawCause = null;

    // 1~2. 수신 샘플 처리
    if (sample) {
      lastTs = sample.ts;
      lastSample = sample;
      lastWasFault = !!sensorFault(sample, th);
      if (!lastWasFault) accept(sample);
    }

    // 3~4. 원시 상태
    if (lastTs == null || now - lastTs >= th.STALE_SEC * 1000) {
      raw = STATES.CHECK;
      rawCause = CHECK_CAUSE.STALE;
    } else if (lastWasFault || !accepted) {
      raw = STATES.CHECK;
      rawCause = CHECK_CAUSE.SENSOR;
    } else {
      const m = metrics();
      raw = weightLevel(m.totalG, m.maxSideG, STATE_META[lastLevel].rank, th);
    }

    // 5. 디바운싱
    const prev = confirmed;
    if (raw === confirmed) {
      candidate = null;
      if (raw === STATES.CHECK) checkCause = rawCause;
    } else {
      const immediate =
        confirmed == null ||
        (confirmed === STATES.CHECK && raw === lastLevel) ||
        rawCause === CHECK_CAUSE.STALE;
      if (candidate !== raw) {
        candidate = raw;
        candidateSince = now;
      }
      if (immediate || now - candidateSince >= th.DEBOUNCE_SEC * 1000) {
        confirmed = raw;
        checkCause = rawCause;
        candidate = null;
        if (raw !== STATES.CHECK) lastLevel = raw;
      }
    }

    // 6. 결과
    const judgement = buildJudgement(now);
    const transition =
      prev != null && prev !== confirmed
        ? { ts: now, from: prev, to: confirmed, reason: judgement.reason[0] ?? "" }
        : null;
    return { judgement, transition };
  }

  function buildJudgement(now) {
    const m = metrics();
    const rainMm = lastSample?.rainMm ?? 0;
    const flags = [];
    if (rainMm >= th.RAIN_MM_H) flags.push(FLAGS.RAINING);

    if (confirmed === STATES.CHECK) {
      return {
        state: confirmed,
        score: null,
        reason: [checkReason(now)],
        flags,
        checkCause,
        metrics: m,
        pending: candidate,
      };
    }

    if (m.rateGPerMin != null && m.rateGPerMin >= th.RATE_FAST_G_MIN) flags.push(FLAGS.FAST);
    if (m.imbalance != null && m.imbalance >= th.IMBALANCE_RATIO) flags.push(FLAGS.IMBALANCE);

    const ratio = Math.max(m.totalG / th.DANGER_TOTAL_G, m.maxSideG / th.DANGER_SIDE_G);
    return {
      state: confirmed,
      score: Math.min(100, Math.round(ratio * 100)),
      reason: weightReason(m, flags, rainMm),
      flags,
      checkCause: null,
      metrics: m,
      pending: candidate,
    };
  }

  function checkReason(now) {
    if (checkCause === CHECK_CAUSE.STALE) {
      if (lastTs == null) return "수신 기록 없음 — 점검 필요";
      const min = Math.floor((now - lastTs) / 60000);
      return `마지막 수신 ${min}분 전 — 통신 두절, 점검 필요`;
    }
    const f = lastSample && sensorFault(lastSample, th);
    if (!f) return "센서 값 이상 — 점검 필요";
    const side = sideName(f.isLeft);
    return f.value == null
      ? `${side}측 로드셀 채널 누락 — 센서 점검 필요`
      : `${side}측 로드셀 값 이상(${fmtG(f.value)}) — 센서 점검 필요`;
  }

  function weightReason(m, flags, rainMm) {
    const lines = [];
    const { leftG, rightG } = m; // 평활값
    const leftHeavier = leftG >= rightG;

    if (m.maxSideG >= th.DANGER_SIDE_G) {
      lines.push(`${sideName(leftHeavier)}측 로드셀 ${fmtG(m.maxSideG)} — 편측 기준(${fmtG(th.DANGER_SIDE_G)}) 초과`);
    } else if (m.totalG >= th.DANGER_TOTAL_G) {
      lines.push(`총 중량 ${fmtG(m.totalG)} — 수거 기준(${fmtG(th.DANGER_TOTAL_G)}) 초과`);
    } else {
      const pct = Math.round((m.totalG / th.DANGER_TOTAL_G) * 100);
      const stage = m.stage > 0 ? ` (${m.stage}단계)` : "";
      lines.push(`총 중량 ${fmtG(m.totalG)}${stage} — 수거 기준(${fmtG(th.DANGER_TOTAL_G)})의 ${pct}%`);
    }

    const env = [];
    if (flags.includes(FLAGS.RAINING)) env.push(`우천 중(${rainMm}mm/h)`);
    if (flags.includes(FLAGS.FAST)) {
      env.push(`최근 ${th.RATE_WINDOW_MIN}분간 분당 약 ${Math.round(m.rateGPerMin)}g씩 증가`);
    }
    if (env.length) lines.push(env.join(" · "));

    if (flags.includes(FLAGS.IMBALANCE)) {
      const share = Math.max(leftG, rightG) / m.totalG;
      lines.push(`${sideName(leftHeavier)}측에 ${Math.round(share * 100)}% 쏠림 — 거름망 점검 권장`);
    }
    return lines;
  }

  return { update };
}

/**
 * 비교 기준: 단순 임계값 방식 (기획서 4.7).
 * 디바운싱·이상치 필터·히스테리시스 없음. 통신 두절 규칙만 동일.
 */
export function createBaseline(th = DEFAULT_TH) {
  let lastTs = null;
  let last = STATES.CHECK;
  return {
    update({ now, sample }) {
      if (sample) {
        lastTs = sample.ts;
        last = classify(sample.leftG, sample.rightG, th);
        return last;
      }
      if (lastTs == null || now - lastTs >= th.STALE_SEC * 1000) return STATES.CHECK;
      return last;
    },
  };
}
