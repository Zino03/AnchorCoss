import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// 개발 서버(npm run dev)에서 api/ 폴더의 핸들러를 그대로 연결한다.
// 배포(Vercel)에서는 Vercel이 api/ 폴더를 서버 함수로 실행하므로 이 부분은 쓰이지 않는다.
// (센서 수신·조회는 SQLite를 쓰므로 로컬 개발 서버에서만 동작한다)
const ROUTES = {
  "/api/weather": "/api/weather.js",
  "/api/sensor-data": "/api/sensor-data.js",
  "/api/stations": "/api/stations.js",
};
const ENV_KEYS = ["KMA_SERVICE_KEY", "DEVICE_TOKEN", "DB_PATH"];

/** Vercel 응답 객체와 같은 모양 (status().json(), setHeader) */
function shim(res) {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      res.setHeader(k, v);
    },
    json(body) {
      res.statusCode = this.statusCode;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
    },
  };
}

function devApi() {
  return {
    name: "dev-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), "");
      for (const k of ENV_KEYS) if (env[k] && !process.env[k]) process.env[k] = env[k];

      for (const [route, file] of Object.entries(ROUTES)) {
        server.middlewares.use(route, async (req, res) => {
          try {
            const mod = await server.ssrLoadModule(file);
            await mod.default(req, shim(res));
          } catch (e) {
            server.config.logger.error(`[dev-api] ${route}: ${e.stack ?? e}`);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ ok: false, error: "서버 오류" }));
            }
          }
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  test: { environment: "node" },
});
