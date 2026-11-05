// 상태 정의 (기획서 4.3). 수위 센서가 빠져 "하부 막힘/침수 위험"은 없다.

export const STATES = Object.freeze({
  NORMAL: "normal", // 정상: 적재 거의 없음
  WARN: "warn", // 주의: 적재 진행 중
  DANGER: "danger", // 위험: 수거 필요
  CHECK: "check", // 점검 필요: 통신 두절 또는 센서 이상
});

export const STATE_META = Object.freeze({
  normal: { label: "정상", icon: "✔", rank: 0 },
  warn: { label: "주의", icon: "▲", rank: 1 },
  danger: { label: "위험 · 수거 필요", icon: "⚠", rank: 2 },
  check: { label: "점검 필요", icon: "?", rank: -1 },
});

// 판정 근거에 붙는 보조 플래그 (상태와 별개)
export const FLAGS = Object.freeze({
  RAINING: "raining", // 우천 중
  FAST: "fast", // 급증
  IMBALANCE: "imbalance", // 편중 (한쪽 쏠림)
});

export const FLAG_LABEL = Object.freeze({
  raining: "우천 중",
  fast: "급증",
  imbalance: "편중",
});

// 점검 필요의 세부 원인
export const CHECK_CAUSE = Object.freeze({
  STALE: "stale", // 통신 두절
  SENSOR: "sensor", // 센서 이상 (음수/범위 초과/채널 누락)
});
