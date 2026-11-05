// GET /api/stations                         → { ok, stations: [{ id, name, lat, lng, latest }] }
// GET /api/stations?id=st-1&since=<ms>      → { ok, samples, lastId }  (since 이후 측정분, 초기 로드)
// GET /api/stations?id=st-1&afterId=<n>     → { ok, samples, lastId }  (n 이후 저장분, 폴링)
//   limit: 최대 건수 (기본 2000, 최대 5000)

import { getDb } from "../server/db.js";
import { query, localOnly } from "../server/http.js";

export default async function handler(req, res) {
  if (localOnly(res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "GET만 지원합니다" });
  }

  const q = query(req);
  const id = q.get("id");
  try {
    if (!id) return res.status(200).json({ ok: true, stations: getDb().listStations() });

    const limit = Math.min(5000, Math.max(1, Number(q.get("limit")) || 2000));
    const afterId = q.has("afterId") ? Number(q.get("afterId")) : null;
    const since = Number(q.get("since")) || 0;
    if (afterId != null && !Number.isFinite(afterId)) {
      return res.status(400).json({ ok: false, error: "afterId는 숫자여야 합니다" });
    }
    const r = getDb().history(id, { since, afterId, limit });
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    console.error("[stations] 조회 실패:", e);
    return res.status(500).json({ ok: false, error: "조회 실패" });
  }
}
