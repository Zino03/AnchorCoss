// 센서 흉내: 하드웨어 없이 수신 API(POST /api/sensor-data)에 샘플을 주기적으로 보낸다.
// 실물과 같은 경로(HTTP → 검증 → SQLite → 화면 실시간 모드)를 처음부터 끝까지 확인하기 위한 도구.
//
// 사용: npm run dev  (다른 터미널에서)
//       npm run fake-sensor                              기본: st-1, 서서히 누적, 5초 간격, 12배속
//       npm run fake-sensor -- --scenario imbalance      시나리오 선택 (normal, gradual, imbalance, rainSurge, collect, commDrop, sensorFault, spike)
//       npm run fake-sensor -- --interval 2 --speed 30   2초마다, 시나리오 30배속
//       npm run fake-sensor -- --url http://192.168.0.10:5173 --count 10
//
// --speed: 실제 1분에 시나리오가 몇 분 진행되는지. 빠르게 돌리면 "급증" 플래그가 실제보다 쉽게 뜬다.
// ⚠ 여기서 보낸 값도 DB에 그대로 저장된다. 발표·합동 테스트 전에는 npm run db:reset -- --yes 로 비울 것.

import { createSimulator } from "../src/sim/simulator.js";
import { SCENARIO_IDS } from "../src/sim/scenario.js";
import { readEnv } from "./_env.js";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const station = arg("station", "st-1");
const scenario = arg("scenario", "gradual");
const intervalSec = Number(arg("interval", 5));
const speed = Number(arg("speed", 12));
const count = Number(arg("count", Infinity));
const base = arg("url", "http://localhost:5173").replace(/\/$/, "");
const token = readEnv("DEVICE_TOKEN");

if (!SCENARIO_IDS.includes(scenario)) {
  console.error(`알 수 없는 시나리오: ${scenario}\n사용 가능: ${SCENARIO_IDS.join(", ")}`);
  process.exit(1);
}
if (!token) {
  console.error("DEVICE_TOKEN이 없습니다. .env.local에 DEVICE_TOKEN=... 을 넣으세요 (.env.example 참고).");
  process.exit(1);
}

const sim = createSimulator({
  stations: [{ id: station, name: station, lat: 0, lng: 0, real: true, scenarioId: scenario }],
  stepSec: intervalSec * speed,
  startTs: 0,
  seed: Date.now() & 0xffff,
});

console.log(`▶ ${base}/api/sensor-data  지점=${station} 시나리오=${scenario} 간격=${intervalSec}s 배속=${speed}×  (Ctrl+C로 종료)`);

let sent = 0;
async function once() {
  const t = sim.elapsedMin(station);
  const { sample } = sim.tick()[0];
  const tag = `[시나리오 ${t.toFixed(1).padStart(5)}분]`;
  if (!sample) {
    console.log(`${tag} 통신 두절 구간 — 전송하지 않음`);
    return;
  }
  const body = {
    stationId: station,
    ts: Date.now(),
    leftG: sample.leftG,
    rightG: sample.rightG,
    rssi: sample.rssi,
    batteryPct: sample.batteryPct,
  };
  try {
    const r = await fetch(`${base}/api/sensor-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-token": token },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    const note = r.ok ? `저장 ${j.accepted}건` : `실패 ${r.status} ${j.error ?? ""}`;
    console.log(`${tag} 좌 ${String(body.leftG).padStart(5)}g  우 ${String(body.rightG).padStart(5)}g  → ${note}`);
  } catch (e) {
    const refused = e.cause?.code === "ECONNREFUSED";
    console.log(`${tag} 전송 실패: ${refused ? "서버가 꺼져 있습니다 (npm run dev 확인)" : e.message}`);
  }
}

async function loop() {
  await once();
  sent++;
  if (sent < count) setTimeout(loop, intervalSec * 1000);
}
loop();
