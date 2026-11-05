import { STATES } from "./states.js";

// 판정 로직 — 3단계에서 구현 (기획서 4장).
// 지금은 계약(Judgement 포맷)만 맞춘 자리표시자.

/** @returns {import("./types.js").Judgement} */
export function judge(/* { sample, history, prev, now } */) {
  return {
    state: STATES.NORMAL,
    score: 0,
    reason: [],
    flags: [],
    checkCause: null,
    metrics: { totalG: null, maxSideG: null, imbalance: null, rateGPerMin: null },
  };
}
