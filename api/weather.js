// GET /api/weather[?lat=..&lng=..] — 기상청 초단기실황 프록시.
// 인증키(KMA_SERVICE_KEY)는 서버에서만 쓰고 브라우저로 보내지 않는다.
// 개발: vite.config.js의 devApi()가 연결 / 배포: Vercel이 서버 함수로 실행.
//
// 응답 200: { ok: true, region, lat, lng, nx, ny, baseDate, baseTime, rainMm, pty, ptyLabel, tempC, humidity, windMs, fetchedAt, cached?, stale?, warning? }
// 응답 4xx/5xx: { ok: false, error, code? }

import { fetchNcst, latLngToGrid } from "../lib/kma.js";
import { REGION } from "../src/config.js";

const TTL_MS = 10 * 60 * 1000; // 실황은 1시간 단위라 10분 캐시면 충분 (호출 수 제한 대비)
const cache = new Map(); // "nx,ny" → { at, data }

export default async function handler(req, res) {
  const key = process.env.KMA_SERVICE_KEY;
  if (!key) {
    return res.status(500).json({ ok: false, error: "KMA_SERVICE_KEY가 설정되지 않았습니다 (.env.local 확인)" });
  }

  const q = new URL(req.url ?? "/", "http://localhost").searchParams;
  const lat = Number(q.get("lat") ?? REGION.lat);
  const lng = Number(q.get("lng") ?? REGION.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
    return res.status(400).json({ ok: false, error: "위치(lat, lng)가 없습니다 (src/config.js의 REGION 확인)" });
  }

  const { nx, ny } = latLngToGrid(lat, lng);
  const ck = `${nx},${ny}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return res.status(200).json({ ...hit.data, cached: true });
  }

  try {
    const w = await fetchNcst({ key, nx, ny });
    const data = { ok: true, region: REGION.name, lat, lng, ...w, fetchedAt: Date.now() };
    cache.set(ck, { at: Date.now(), data });
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=300");
    return res.status(200).json(data);
  } catch (e) {
    // 직전에 받은 값이 있으면 그걸로 응답 (화면이 갑자기 비지 않게)
    if (hit) return res.status(200).json({ ...hit.data, stale: true, warning: e.message });
    return res.status(502).json({ ok: false, error: e.message, code: e.code ?? null });
  }
}

/** 테스트용: 캐시 비우기 */
export function _clearCache() {
  cache.clear();
}
