// 기상청 단기예보 조회서비스 — 초단기실황(getUltraSrtNcst) 호출·파싱.
// 서버(api/weather.js)에서만 쓴다. 인증키가 브라우저로 나가지 않게 하기 위함.
//
// 쓰는 값: RN1(1시간 강수량 mm) → 판정의 강우량(mm/h), PTY(강수 형태), T1H(기온), REH(습도), WSD(풍속)
// 제공 시각: 매시 정각 관측, 매시 40분 이후 조회 가능 → 40분 전이면 한 시간 전 자료를 요청한다.

const NCST_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";

export class KmaError extends Error {
  constructor(code, message) {
    super(`기상청 API 오류(${code}): ${message}`);
    this.code = code;
  }
}

/**
 * 위경도 → 기상청 격자(nx, ny). 기상청 공식 Lambert Conformal Conic 변환식.
 * 격자 1칸 = 5km.
 */
export function latLngToGrid(lat, lng) {
  const RE = 6371.00877; // 지구 반경 (km)
  const GRID = 5.0; // 격자 간격 (km)
  const SLAT1 = 30.0; // 표준위도 1
  const SLAT2 = 60.0; // 표준위도 2
  const OLON = 126.0; // 기준점 경도
  const OLAT = 38.0; // 기준점 위도
  const XO = 43; // 기준점 X 격자
  const YO = 136; // 기준점 Y 격자

  const D = Math.PI / 180;
  const re = RE / GRID;
  const slat1 = SLAT1 * D;
  const slat2 = SLAT2 * D;
  const olon = OLON * D;
  const olat = OLAT * D;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * D - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

const pad = (n) => String(n).padStart(2, "0");

/** 조회할 실황 기준 시각 (KST). 40분 전이면 한 시간 전. hoursBack으로 더 이전 시각 요청 */
export function ncstBaseTime(now = Date.now(), hoursBack = 0) {
  const kst = new Date(now + 9 * 3600e3);
  if (kst.getUTCMinutes() < 40) kst.setUTCHours(kst.getUTCHours() - 1);
  if (hoursBack) kst.setUTCHours(kst.getUTCHours() - hoursBack);
  return {
    baseDate: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    baseTime: `${pad(kst.getUTCHours())}00`,
  };
}

export function buildNcstUrl({ key, nx, ny, baseDate, baseTime }) {
  const url = new URL(NCST_URL);
  url.searchParams.set("serviceKey", key); // Decoding 키를 넣으면 URLSearchParams가 인코딩한다
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "10");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("base_date", baseDate);
  url.searchParams.set("base_time", baseTime);
  url.searchParams.set("nx", String(nx));
  url.searchParams.set("ny", String(ny));
  return url;
}

/** 초단기실황 강수 형태 코드 */
export const PTY_LABEL = {
  0: "강수 없음",
  1: "비",
  2: "비/눈",
  3: "눈",
  5: "빗방울",
  6: "빗방울/눈날림",
  7: "눈날림",
};

/**
 * 강수량 문자열 → mm. 실황은 보통 숫자("0", "1.5")지만 예보형 문자열도 방어적으로 처리.
 * "강수없음" → 0, "1mm 미만" → 0.5, "30.0~50.0mm" → 30, "50.0mm 이상" → 50
 */
export function parseRainMm(v) {
  if (v == null || v === "" || /없음/.test(String(v))) return 0;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  if (!m) return 0;
  const n = Number(m[0]);
  if (n < 0) return 0; // 결측(-998.9 등)
  return /미만/.test(String(v)) ? n / 2 : n;
}

const num = (v) => (v == null || v === "" || Number(v) <= -900 ? null : Number(v));

/** 응답 본문(text) → 정리된 실황 값. 오류면 KmaError */
export function parseNcst(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    // 인증키 오류 등은 JSON 요청이어도 XML로 온다
    const code = text.match(/<returnReasonCode>([^<]+)/)?.[1] ?? text.match(/<resultCode>([^<]+)/)?.[1] ?? "XML";
    const msg =
      text.match(/<returnAuthMsg>([^<]+)/)?.[1] ??
      text.match(/<resultMsg>([^<]+)/)?.[1] ??
      text.match(/<errMsg>([^<]+)/)?.[1] ??
      "JSON이 아닌 응답";
    throw new KmaError(code, msg);
  }
  const h = j?.response?.header;
  if (!h) throw new KmaError("FORMAT", "응답 형식이 예상과 다릅니다");
  if (h.resultCode !== "00") throw new KmaError(h.resultCode, h.resultMsg);

  const items = j.response.body?.items?.item ?? [];
  if (!items.length) throw new KmaError("03", "NO_DATA");
  const v = Object.fromEntries(items.map((it) => [it.category, it.obsrValue]));
  const pty = Number(v.PTY ?? 0);
  return {
    baseDate: items[0].baseDate,
    baseTime: items[0].baseTime,
    nx: items[0].nx,
    ny: items[0].ny,
    rainMm: parseRainMm(v.RN1),
    pty,
    ptyLabel: PTY_LABEL[pty] ?? `코드 ${pty}`,
    tempC: num(v.T1H),
    humidity: num(v.REH),
    windMs: num(v.WSD),
  };
}

/**
 * 초단기실황 조회. 해당 시각 자료가 아직 없으면(NO_DATA) 한 시간 전으로 한 번 더 시도한다.
 * @param {{ key: string, nx: number, ny: number, now?: number, fetchImpl?: typeof fetch }} opt
 */
export async function fetchNcst({ key, nx, ny, now = Date.now(), fetchImpl = fetch }) {
  let lastErr;
  for (let back = 0; back < 2; back++) {
    const base = ncstBaseTime(now, back);
    const res = await fetchImpl(buildNcstUrl({ key, nx, ny, ...base }));
    if (!res.ok) throw new KmaError(`HTTP${res.status}`, "기상청 서버 응답 오류");
    try {
      return parseNcst(await res.text());
    } catch (e) {
      lastErr = e;
      if (!(e instanceof KmaError) || e.code !== "03") throw e;
    }
  }
  throw lastErr;
}
