// 기상청 강수 데이터 프록시 (TODO: lib/kma.js 연동)
export default async function handler(req, res) {
  if (!process.env.KMA_SERVICE_KEY) {
    return res.status(500).json({ error: "KMA_SERVICE_KEY not set" });
  }
  res.status(501).json({ error: "not implemented" });
}
