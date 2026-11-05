import { STATES } from "./states.js";

// TODO: 임계값 + 속도 기반 판정 구현
export function judge(/* { sample, rain, history } */) {
  return { state: STATES.NORMAL, score: 0, reason: "" };
}
