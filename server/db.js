// SQLite 저장소 (Node 내장 node:sqlite, Node 22.13+).
// DB 접근은 이 파일에만 둔다 → 나중에 다른 DB로 바꿀 때 여기만 고치면 된다.
//
// 스키마는 개발계획서 4장(지점 ID, 시각, 측정값, 강우량, 신호 세기, 배터리, 시각·지점 인덱스)을
// 로드셀 2개 기준으로 바꾼 것. 판정 단계·근거 저장은 후속 단계 (판정은 지금 브라우저에서 한다).

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_STATIONS } from "../src/sim/simulator.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS stations (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  lat        REAL,
  lng        REAL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS samples (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id  TEXT    NOT NULL REFERENCES stations(id),
  ts          INTEGER NOT NULL,   -- 측정 시각 (epoch ms)
  received_at INTEGER NOT NULL,   -- 서버 수신 시각
  left_g      REAL,               -- NULL = 채널 누락, 음수 = 센서 이상 (그대로 저장)
  right_g     REAL,
  rain_mm     REAL,               -- 수신 시점의 기상청 강우 (없으면 NULL)
  rssi        INTEGER,
  battery_pct INTEGER,
  UNIQUE (station_id, ts)
);

CREATE INDEX IF NOT EXISTS idx_samples_station_ts ON samples (station_id, ts);
`;

const DEFAULT_PATH = "data/anchor.db";
const MAX_TS_BUMP = 50; // 같은 시각에 다른 값이 오면 1ms씩 밀어서 보관 (최대 50회)

/** DB 행 → Sample (src/logic/types.js) + 저장 정보 */
function toSample(r) {
  return {
    id: r.id,
    stationId: r.station_id,
    ts: r.ts,
    receivedAt: r.received_at,
    leftG: r.left_g,
    rightG: r.right_g,
    rainMm: r.rain_mm,
    rssi: r.rssi,
    batteryPct: r.battery_pct,
  };
}

const sameValues = (row, s) =>
  row.left_g === s.leftG && row.right_g === s.rightG && row.rssi === s.rssi && row.battery_pct === s.batteryPct;

/**
 * DB 열기. file이 ":memory:"면 메모리 DB (테스트용).
 * @param {string} [file]
 */
export function openDb(file = process.env.DB_PATH || DEFAULT_PATH) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec("PRAGMA foreign_keys = ON;");
  if (file !== ":memory:") d.exec("PRAGMA journal_mode = WAL;");
  d.exec(SCHEMA);

  const q = {
    insertStation: d.prepare(
      "INSERT OR IGNORE INTO stations (id, name, lat, lng, created_at) VALUES (?, ?, ?, ?, ?)",
    ),
    findAt: d.prepare("SELECT * FROM samples WHERE station_id = ? AND ts = ?"),
    insertSample: d.prepare(
      `INSERT INTO samples (station_id, ts, received_at, left_g, right_g, rain_mm, rssi, battery_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    stations: d.prepare("SELECT * FROM stations ORDER BY id"),
    latest: d.prepare("SELECT * FROM samples WHERE station_id = ? ORDER BY ts DESC LIMIT 1"),
    // since 이후 "최신" limit건 (건수가 넘치면 오래된 쪽을 버린다) — 오름차순으로 돌려줌
    since: d.prepare(
      `SELECT * FROM (SELECT * FROM samples WHERE station_id = ? AND ts >= ? ORDER BY ts DESC LIMIT ?)
       ORDER BY ts`,
    ),
    afterId: d.prepare("SELECT * FROM samples WHERE station_id = ? AND id > ? ORDER BY id LIMIT ?"),
    maxId: d.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM samples WHERE station_id = ?"),
  };

  /** 처음 보는 지점이면 등록 (기본 지점 목록에 있으면 이름·좌표도 채움) */
  function ensureStation(id, now = Date.now()) {
    const known = DEFAULT_STATIONS.find((s) => s.id === id);
    q.insertStation.run(id, known?.name ?? id, known?.lat ?? null, known?.lng ?? null, now);
  }

  /** @returns {"inserted"|"duplicate"} */
  function insertSample(s) {
    ensureStation(s.stationId, s.receivedAt);
    let ts = s.ts;
    for (let i = 0; i <= MAX_TS_BUMP; i++, ts++) {
      const row = q.findAt.get(s.stationId, ts);
      if (!row) {
        q.insertSample.run(s.stationId, ts, s.receivedAt, s.leftG, s.rightG, s.rainMm, s.rssi, s.batteryPct);
        return "inserted";
      }
      if (i === 0 && sameValues(row, s)) return "duplicate"; // 재전송된 같은 샘플
    }
    throw new Error(`같은 시각(${s.ts})의 샘플이 너무 많습니다`);
  }

  return {
    /** 여러 건을 한 트랜잭션으로 저장 */
    insertMany(samples) {
      let inserted = 0;
      let duplicates = 0;
      d.exec("BEGIN");
      try {
        for (const s of samples) {
          if (insertSample(s) === "inserted") inserted++;
          else duplicates++;
        }
        d.exec("COMMIT");
      } catch (e) {
        d.exec("ROLLBACK");
        throw e;
      }
      return { inserted, duplicates };
    },

    /** 지점 목록 + 각 지점 최근 샘플 */
    listStations() {
      return q.stations.all().map((r) => {
        const last = q.latest.get(r.id);
        return { id: r.id, name: r.name, lat: r.lat, lng: r.lng, latest: last ? toSample(last) : null };
      });
    },

    /**
     * 지점 이력. afterId가 있으면 그 이후 저장분(폴링용), 없으면 since 이후 측정분(초기 로드용).
     * 초기 로드가 limit을 넘으면 오래된 쪽을 버리고 최신 limit건을 준다 (1초 간격이면 1시간이 3600건).
     * lastId: 다음 폴링에 쓸 커서
     */
    history(stationId, { since = 0, afterId = null, limit = 2000 } = {}) {
      const rows =
        afterId != null ? q.afterId.all(stationId, afterId, limit) : q.since.all(stationId, since, limit);
      const samples = rows.map(toSample);
      const lastId = afterId != null
        ? (samples.length ? Math.max(...samples.map((s) => s.id)) : afterId)
        : q.maxId.get(stationId).m;
      return { samples, lastId };
    },

    close() {
      d.close();
    },
  };
}

// 서버 전체에서 하나만 연다
let shared = null;
export function getDb() {
  if (!shared) shared = openDb();
  return shared;
}

/** 테스트용: 공유 DB 교체 */
export function _setDb(repo) {
  shared = repo;
}
