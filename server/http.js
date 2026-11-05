// API 핸들러 공통 도우미 (Vercel / Vite 개발 미들웨어 양쪽에서 동작)
import crypto from "node:crypto";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** JSON 본문 읽기. Vercel은 req.body가 이미 파싱돼 있고, 개발 서버는 스트림에서 읽는다 */
export async function readJson(req, limit = 256 * 1024) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return parseJson(req.body);
    if (Buffer.isBuffer(req.body)) return parseJson(req.body.toString("utf8"));
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, "본문이 너무 큽니다");
    chunks.push(c);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) throw new HttpError(400, "본문이 비어 있습니다");
  return parseJson(text);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "JSON 형식이 아닙니다");
  }
}

/** 토큰 비교 (시간차 공격 방지) */
export function tokenMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** 쿼리스트링 */
export function query(req) {
  return new URL(req.url ?? "/", "http://localhost").searchParams;
}

/** SQLite는 서버리스(Vercel)에서 쓸 수 없다 → 로컬 실행에서만 */
export function localOnly(res) {
  if (!process.env.VERCEL) return false;
  res.status(501).json({ ok: false, error: "센서 수신·조회는 로컬 서버(npm run dev)에서만 지원합니다" });
  return true;
}
