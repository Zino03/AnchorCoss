// 화면 표시용 순수 함수 (React 무관, 테스트 가능)

import { STATES, FLAGS } from "../logic/states.js";

/** 상태별 지점 수 { normal, warn, danger, check } */
export function countByState(stations) {
  const c = { [STATES.NORMAL]: 0, [STATES.WARN]: 0, [STATES.DANGER]: 0, [STATES.CHECK]: 0 };
  for (const s of stations) {
    const st = s.judgement?.state;
    if (st in c) c[st] += 1;
  }
  return c;
}

/**
 * 수거 우선순위 정렬 (DESIGN.md 5장 PriorityList)
 * 1) 점검 필요는 맨 아래  2) 막힘 점수 내림차순  3) 같은 점수면 우천 중 우선  4) 이름순
 */
export function sortByPriority(stations) {
  const isCheck = (s) => s.judgement?.state === STATES.CHECK;
  const raining = (s) => (s.judgement?.flags ?? []).includes(FLAGS.RAINING);
  return [...stations].sort((a, b) => {
    if (isCheck(a) !== isCheck(b)) return isCheck(a) ? 1 : -1;
    const ds = (b.judgement?.score ?? -1) - (a.judgement?.score ?? -1);
    if (ds !== 0) return ds;
    if (raining(a) !== raining(b)) return raining(a) ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });
}

/** 경과 시간: 방금 / N분 전 / N시간 전 */
export function fmtAgo(now, ts) {
  if (ts == null) return "수신 없음";
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 전`;
}

/** 시각 HH:MM:SS (24시간) */
export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("ko-KR", { hour12: false });
}

/** 1,234g */
export function fmtG(v) {
  return v == null ? "—" : `${Math.round(v).toLocaleString("ko-KR")}g`;
}

/** 시각 HH:MM (그래프 축) */
export function fmtHM(ts) {
  return new Date(ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** 신호 세기 4단계 (dBm): -60 이상 4칸 … -90 미만 0칸 */
export function rssiLevel(rssi) {
  if (rssi == null) return 0;
  if (rssi >= -60) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -80) return 2;
  if (rssi >= -90) return 1;
  return 0;
}

/** 센서 값이 유효한지 (음수·누락·범위 초과는 무효) */
const valid = (v, maxG) => v != null && v >= 0 && v <= maxG;

/**
 * 샘플 이력 → 그래프 데이터.
 * 수신이 끊긴 구간(gapMs 초과)에는 null 점을 넣어 선이 이어지지 않게 한다.
 * 센서 이상값은 null로 바꿔 그래프에서 빠지게 한다.
 */
export function toChartData(history, { gapMs = 30_000, maxG = 5000 } = {}) {
  const out = [];
  for (let i = 0; i < history.length; i++) {
    const s = history[i];
    const prev = history[i - 1];
    if (prev && s.ts - prev.ts > gapMs) {
      out.push({ ts: prev.ts + 1, left: null, right: null, total: null, rain: prev.rainMm });
    }
    const l = valid(s.leftG, maxG) ? s.leftG : null;
    const r = valid(s.rightG, maxG) ? s.rightG : null;
    out.push({ ts: s.ts, left: l, right: r, total: l != null && r != null ? l + r : null, rain: s.rainMm });
  }
  return out;
}

/** 강우 구간 [{ from, to }] (rain ≥ minMm 이 이어지는 구간) */
export function rainSegments(data, minMm) {
  const segs = [];
  let start = null;
  for (let i = 0; i < data.length; i++) {
    const on = data[i].rain >= minMm;
    if (on && start == null) start = data[i].ts;
    if (!on && start != null) {
      segs.push({ from: start, to: data[i - 1].ts });
      start = null;
    }
  }
  if (start != null) segs.push({ from: start, to: data[data.length - 1].ts });
  return segs;
}
