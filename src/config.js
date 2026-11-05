// 지점/임계값 설정 (하드코딩 대신 이 파일에서 조정)
export const REGION = { name: "춘천", lat: 37.8813, lng: 127.7298, nx: 73, ny: 134 };

// 예시 값 — 실측/멘토링 후 조정
export const TH = {
  warnWeightG: 500,   // 주의: 쓰레기 중량(g)
  dangerWeightG: 1500, // 위험
  debounceSec: 60,
  rainyMmPerH: 1,
};
