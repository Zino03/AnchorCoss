// 센서 수신 데이터 검증·정규화. 하드웨어 규격이 바뀌면 여기(입구)만 고친다.
//
// 받는 형식 (객체 1건 또는 배열):
//   { stationId: "st-1", ts?: epoch(ms 또는 초), leftG: number|null, rightG: number|null, rssi?: number, batteryPct?: number }
// - 숫자 문자열("312")도 받는다 (펌웨어 편의)
// - 음수·범위 초과 같은 "센서 이상값"은 거절하지 않고 그대로 저장한다 → 판정에서 점검 필요로 처리
// - 형식 오류(숫자가 아님, 필수 필드 없음)만 거절한다

export const MAX_BATCH = 500;
const FUTURE_SKEW_MS = 60 * 1000; // 기기 시계가 1분 넘게 앞서면 신뢰하지 않음
const PAST_LIMIT_MS = 24 * 3600 * 1000; // 하루보다 오래된 시각도 신뢰하지 않음 (시계 미설정 등)

function toNum(v, name, { int = false } = {}) {
  if (v === undefined || v === null || v === "") return { v: null };
  const n = typeof v === "string" ? Number(v.trim()) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return { err: `${name}: 숫자 또는 null이어야 합니다` };
  return { v: int ? Math.round(n) : n };
}

/**
 * @param {unknown} raw
 * @param {{ receivedAt: number, rainMm?: number|null }} ctx
 * @returns {{ sample?: object, tsAdjusted?: boolean, error?: string }}
 */
export function normalizeSample(raw, { receivedAt, rainMm = null }) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "객체가 아닙니다" };

  const stationId = typeof raw.stationId === "number" ? String(raw.stationId) : raw.stationId;
  if (typeof stationId !== "string" || !/^[\w-]{1,32}$/.test(stationId)) {
    return { error: "stationId: 영문·숫자·_·- 1~32자" };
  }
  if (!("leftG" in raw) || !("rightG" in raw)) {
    return { error: "leftG, rightG가 필요합니다 (채널 누락은 null)" };
  }

  const fields = {};
  for (const [key, opt] of [["leftG"], ["rightG"], ["rssi", { int: true }], ["batteryPct", { int: true }]]) {
    const r = toNum(raw[key], key, opt);
    if (r.err) return { error: r.err };
    fields[key] = r.v;
  }

  // 측정 시각: 없으면 수신 시각. 초 단위면 ms로. 믿기 어려우면 수신 시각으로 대체
  const tsr = toNum(raw.ts, "ts", { int: true });
  if (tsr.err) return { error: tsr.err };
  let ts = tsr.v;
  let tsAdjusted = false;
  if (ts == null) {
    ts = receivedAt;
  } else {
    if (ts < 1e12) ts *= 1000;
    if (ts > receivedAt + FUTURE_SKEW_MS || ts < receivedAt - PAST_LIMIT_MS) {
      ts = receivedAt;
      tsAdjusted = true;
    }
  }

  return {
    sample: { stationId, ts, receivedAt, ...fields, rainMm },
    tsAdjusted,
  };
}

/**
 * 본문(객체 또는 배열) 전체 검증.
 * @returns {{ samples: object[], rejected: {index:number, error:string}[], adjusted: number, error?: string }}
 */
export function normalizeBatch(body, ctx) {
  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) return { samples: [], rejected: [], adjusted: 0, error: "빈 배열입니다" };
  if (list.length > MAX_BATCH) {
    return { samples: [], rejected: [], adjusted: 0, error: `한 번에 최대 ${MAX_BATCH}건까지 보낼 수 있습니다` };
  }
  const samples = [];
  const rejected = [];
  let adjusted = 0;
  list.forEach((raw, index) => {
    const r = normalizeSample(raw, ctx);
    if (r.error) rejected.push({ index, error: r.error });
    else {
      samples.push(r.sample);
      if (r.tsAdjusted) adjusted++;
    }
  });
  return { samples, rejected, adjusted };
}
