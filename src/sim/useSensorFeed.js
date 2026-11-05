// 실물 센서 데이터를 서버(/api/stations)에서 주기적으로 가져오는 훅.
// 처음에는 최근 1시간 이력을 받아 복원하고(알림 없음), 이후에는 새로 저장된 것만 받는다(afterId 커서).
//
// const feed = useSensorFeed({ enabled, stationId, onSamples });
// onSamples(samples, { silent })  — silent: 초기 이력 복원이면 true
// feed.status   "off" | "connecting" | "ok" | "error"
// feed.error    오류 문구 | null
// feed.lastAt   마지막으로 새 샘플을 받은 실제 시각 | null

import { useEffect, useRef, useState } from "react";

const POLL_MS = 3000;
const HISTORY_MS = 60 * 60 * 1000;

export function useSensorFeed({ enabled, stationId, onSamples, intervalMs = POLL_MS, resetKey = 0 }) {
  const [state, setState] = useState({ status: "off", error: null, lastAt: null });
  const cb = useRef(onSamples);
  cb.current = onSamples;

  useEffect(() => {
    if (!enabled || !stationId) {
      setState({ status: "off", error: null, lastAt: null });
      return undefined;
    }
    let cancelled = false;
    let cursor = null; // afterId
    let timer = null;
    setState({ status: "connecting", error: null, lastAt: null });

    async function poll() {
      const initial = cursor == null;
      const q = initial ? `since=${Date.now() - HISTORY_MS}` : `afterId=${cursor}`;
      try {
        const r = await fetch(`/api/stations?id=${encodeURIComponent(stationId)}&${q}`);
        let j;
        try {
          j = await r.json();
        } catch {
          throw new Error("센서 서버에 연결할 수 없습니다 (npm run dev로 실행했는지 확인)");
        }
        if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
        if (cancelled) return;
        cursor = j.lastId;
        if (j.samples.length) cb.current(j.samples, { silent: initial });
        setState((s) => ({
          status: "ok",
          error: null,
          lastAt: j.samples.length ? Date.now() : s.lastAt,
        }));
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, status: "error", error: e.message }));
      } finally {
        if (!cancelled) timer = setTimeout(poll, intervalMs);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, stationId, intervalMs, resetKey]);

  return state;
}
