// 지점·임계값 설정. 판정 로직은 이 값만 참조한다 (하드코딩 금지).
// 기획서 4.8·4.9 — 하드웨어팀 1차 답변(로드셀 정격 1kg ×2, 오차 ±100g 가정, 수거 후보 250/500/1000g) 기준.
// 실측 전 예상값이므로 합동 테스트 후 다시 보정한다.

// 기상청 대상 지역 (기획서 7장). 기상청 격자는 5km 단위라 동네 수준이면 충분하다.
// 격자 좌표(nx, ny)는 lib/kma.js의 latLngToGrid()가 위경도로 계산한다 (충북대 부근 → 68, 106).
export const REGION = {
  name: "청주 충북대 부근",
  lat: 36.6286,
  lng: 127.4561,
};

// 지도 초기 중심. 가상 지점 좌표는 이 주변에 배치된다 (src/sim/simulator.js)
export const MAP_CENTER = { lat: REGION.lat, lng: REGION.lng, zoom: 15 };

export const TH = Object.freeze({
  WARN_TOTAL_G: 250, // 주의 기준 = 하드웨어 1단계 (총 중량, g)
  MID_TOTAL_G: 500, // 중간 눈금 = 하드웨어 2단계. 상태는 바꾸지 않고 근거 문구·그래프·게이지에 표시
  DANGER_TOTAL_G: 1000, // 위험·수거 기준 = 하드웨어 3단계 (총 중량, g)
  DANGER_SIDE_G: 700, // 위험 기준 (한쪽 중량, g). 로드셀 정격 1kg의 70% — 포화 전에 감지
  IMBALANCE_MIN_G: 200, // 편중 계산을 시작하는 최소 총량 (g)
  IMBALANCE_RATIO: 0.7, // 편중 플래그 기준 |L-R|/total (한쪽이 85% 이상)
  RATE_FAST_G_MIN: 40, // 급증 플래그 기준 (분당 g)
  RATE_WINDOW_MIN: 10, // 증가 속도 계산 구간 (분)
  RATE_MIN_SPAN_MIN: 5, // 증가 속도를 계산하기 위한 최소 데이터 구간 (분). 짧으면 노이즈로 급증 오탐
  SMOOTH_SEC: 30, // 판정에 쓰는 이동 중앙값 구간 (초). 노이즈(±100g)·순간 충격 완화
  RAIN_MM_H: 1, // 우천 판정 기준 (mm/h)
  DEBOUNCE_SEC: 30, // 새 상태 조건이 이 시간 이상 지속돼야 상태 변경
  MAX_JUMP_G: 450, // 직전 샘플 대비 이 이상 변하면 일시 이상치로 간주
  RECOVER_RATIO: 0.65, // 위험/주의에서 내려올 때 기준값 배율 (오차 ±100g에서도 경계 깜빡임 방지)
  STALE_SEC: 300, // 마지막 수신 후 이 시간 지나면 통신 두절 (센서는 1초 주기 전송 가정)
  MAX_VALID_G: 1200, // 센서 유효 최대값 (g). 정격 1kg + 여유, 초과는 센서 이상·포화로 처리
  LOADCELL_MAX_G: 1000, // 로드셀 정격 (한쪽, g) — 게이지 눈금 최대
});
