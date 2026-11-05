// 백(로직·시뮬레이터)과 프론트(화면) 사이의 데이터 계약. 기획서 3.1 기준.
// 실물 센서 데이터도 같은 Sample 포맷으로 들어오면 판정·화면 코드는 바뀌지 않는다.

/**
 * 센서 샘플 1건.
 * @typedef {Object} Sample
 * @property {string} stationId   지점 ID
 * @property {number} ts          측정 시각 (epoch ms)
 * @property {number|null} leftG  좌 로드셀 중량 (g), 채널 누락 시 null
 * @property {number|null} rightG 우 로드셀 중량 (g), 채널 누락 시 null
 * @property {number} rainMm      강우량 (mm/h)
 * @property {number} rssi        통신 신호 세기 (dBm, 예: -40 ~ -100)
 * @property {number} batteryPct  배터리 잔량 (0~100)
 */

/**
 * 판정 결과. judge()가 반환한다.
 * @typedef {Object} Judgement
 * @property {"normal"|"warn"|"danger"|"check"} state  확정 상태 (STATES)
 * @property {number} score      막힘 점수 0~100 (check 이면 null)
 * @property {string[]} reason   판정 근거 문장 (화면 표시용, 1~3줄)
 * @property {string[]} flags    보조 플래그 (FLAGS: raining/fast/imbalance)
 * @property {"stale"|"sensor"|null} checkCause  점검 필요 원인 (CHECK_CAUSE)
 * @property {Object} metrics    파생 값 (기획서 4.2)
 * @property {number|null} metrics.totalG
 * @property {number|null} metrics.maxSideG
 * @property {number|null} metrics.imbalance
 * @property {number|null} metrics.rateGPerMin
 */

/**
 * 화면에 넘기는 지점 정보.
 * @typedef {Object} Station
 * @property {string} id
 * @property {string} name
 * @property {number} lat
 * @property {number} lng
 * @property {boolean} real        실물 센서 지점이면 true
 * @property {Sample|null} latest  가장 최근 샘플
 * @property {Sample[]} history    최근 샘플 (그래프용)
 * @property {Judgement} judgement 현재 판정
 * @property {{ts:number, from:string, to:string, reason:string}[]} transitions 상태 전환 이력
 */

export {};
