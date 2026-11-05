// 스크립트용: process.env → .env.local → .env 순으로 값 읽기 (Vite 밖에서 실행되므로 직접 파싱)
import fs from "node:fs";

function parse(file) {
  try {
    const out = {};
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

export function readEnv(key) {
  return process.env[key] ?? parse(".env.local")[key] ?? parse(".env")[key];
}
