// 센서 DB 비우기 (테스트 데이터 정리용). 실행 전 개발 서버(npm run dev)를 끌 것.
// 사용: npm run db:reset            → 삭제 대상만 보여줌
//       npm run db:reset -- --yes   → 실제 삭제
import fs from "node:fs";
import { readEnv } from "./_env.js";

const file = readEnv("DB_PATH") || "data/anchor.db";
const targets = [file, `${file}-wal`, `${file}-shm`].filter((f) => fs.existsSync(f));

if (!targets.length) {
  console.log(`삭제할 DB가 없습니다 (${file})`);
  process.exit(0);
}
if (!process.argv.includes("--yes")) {
  console.log(`삭제 대상: ${targets.join(", ")}\n실제로 지우려면: npm run db:reset -- --yes  (개발 서버를 먼저 끄세요)`);
  process.exit(0);
}
try {
  for (const f of targets) fs.rmSync(f);
  console.log(`삭제했습니다: ${targets.join(", ")}`);
} catch (e) {
  if (e.code === "EBUSY" || e.code === "EPERM") {
    console.error("DB 파일이 사용 중입니다. 개발 서버(npm run dev)를 끄고 다시 실행하세요.");
    process.exit(1);
  }
  throw e;
}
