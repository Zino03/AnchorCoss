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
