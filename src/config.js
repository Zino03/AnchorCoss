// 지점·임계값 설정. 판정 로직은 이 값만 참조한다 (하드코딩 금지).
// 기획서 4.8 — 임의의 초기값. 실물 로드셀 보정 후 합동 테스트에서 교체한다.

// 기상청 대상 지역 — 팀원에게 받는 중이라 비워둔다 (기획서 7장).
// nx, ny: 기상청 단기예보 격자 좌표
export const REGION = {
  name: "",
  lat: null,
  lng: null,
  nx: null,
  ny: null,
};

// 지도 초기 중심 (REGION 확정 전 임시값: 춘천시청 부근)
export const MAP_CENTER = { lat: 37.8813, lng: 127.7298, zoom: 14 };

export const TH = Object.freeze({
  WARN_TOTAL_G: 600, // 주의 기준 (총 중량, g)
  DANGER_TOTAL_G: 1500, // 위험·수거 기준 (총 중량, g)
  DANGER_SIDE_G: 1000, // 위험 기준 (한쪽 중량, g)
  IMBALANCE_MIN_G: 300, // 편중 계산을 시작하는 최소 총량 (g)
  IMBALANCE_RATIO: 0.7, // 편중 플래그 기준 |L-R|/total (한쪽이 85% 이상)
  RATE_FAST_G_MIN: 60, // 급증 플래그 기준 (분당 g)
  RATE_WINDOW_MIN: 10, // 증가 속도 계산 구간 (분)
  RAIN_MM_H: 1, // 우천 판정 기준 (mm/h)
  DEBOUNCE_SEC: 30, // 새 상태 조건이 이 시간 이상 지속돼야 상태 변경
  MAX_JUMP_G: 800, // 직전 샘플 대비 이 이상 변하면 일시 이상치로 간주
  RECOVER_RATIO: 0.8, // 위험/주의에서 내려올 때 기준값 배율 (히스테리시스)
  STALE_SEC: 300, // 마지막 수신 후 이 시간 지나면 통신 두절
  MAX_VALID_G: 5000, // 센서 유효 최대값 (g)
});
