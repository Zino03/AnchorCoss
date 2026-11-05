// POST /api/sensor-data — 센서 샘플 수신 → 검증 → SQLite 저장
//
// 헤더: x-device-token: <DEVICE_TOKEN>
// 본문: 객체 1건 또는 배열 (형식은 server/ingest.js)
// 응답: { ok, accepted, duplicates, adjustedTs, rejected: [{ index, error }] }
//   - 일부만 형식 오류면 200 (정상분은 저장), 전부 오류면 400

import { getDb } from "../server/db.js";
import { normalizeBatch } from "../server/ingest.js";
import { readJson, tokenMatches, localOnly } from "../server/http.js";
import { peekLatestWeather } from "./weather.js";

export default async function handler(req, res) {
  if (localOnly(res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "POST만 지원합니다" });
  }

  const token = process.env.DEVICE_TOKEN;
  if (!token) {
    return res.status(503).json({ ok: false, error: "DEVICE_TOKEN이 설정되지 않아 수신하지 않습니다 (.env.local)" });
  }
  if (!tokenMatches(req.headers?.["x-device-token"], token)) {
    return res.status(401).json({ ok: false, error: "x-device-token이 올바르지 않습니다" });
  }

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return res.status(e.status ?? 400).json({ ok: false, error: e.message });
  }

  // 센서는 강우를 보내지 않는다 → 서버가 갖고 있는 최신 기상청 값을 붙인다 (없으면 null)
  const receivedAt = Date.now();
  const { samples, rejected, adjusted, error } = normalizeBatch(body, {
    receivedAt,
    rainMm: peekLatestWeather()?.rainMm ?? null,
  });
  if (error) return res.status(400).json({ ok: false, error });
  if (!samples.length) return res.status(400).json({ ok: false, accepted: 0, duplicates: 0, rejected });

  try {
    const r = getDb().insertMany(samples);
    return res.status(200).json({
      ok: true,
      accepted: r.inserted,
      duplicates: r.duplicates,
      adjustedTs: adjusted,
      rejected,
    });
  } catch (e) {
    console.error("[sensor-data] 저장 실패:", e);
    return res.status(500).json({ ok: false, error: "저장 실패" });
  }
}
