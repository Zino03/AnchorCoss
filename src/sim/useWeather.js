// 기상청 실황을 서버(/api/weather)에서 주기적으로 가져오는 훅.
// enabled가 false면 호출하지 않는다 (시뮬레이션 모드에서는 쓰지 않음).
//
// const weather = useWeather({ enabled });
// weather.data     { region, rainMm, pty, ptyLabel, tempC, humidity, windMs, baseDate, baseTime, ... } | null
// weather.error    오류 문구 | null  (data가 있는데 error도 있으면: 직전 값을 쓰는 중)
// weather.loading  true/false
// weather.refresh()

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 10 * 60 * 1000; // 실황은 1시간 단위 갱신. 서버도 10분 캐시

export function useWeather({ enabled, intervalMs = POLL_MS } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: false });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await fetch("/api/weather");
      let j;
      try {
        j = await r.json();
      } catch {
        // npm run preview 등 API가 없는 환경이면 index.html이 돌아온다
        throw new Error("기상 서버에 연결할 수 없습니다 (npm run dev로 실행했는지 확인)");
      }
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      if (alive.current) setState({ data: j, error: j.warning ?? null, loading: false });
    } catch (e) {
      if (alive.current) setState((s) => ({ ...s, error: e.message, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const h = setInterval(refresh, intervalMs);
    return () => clearInterval(h);
  }, [enabled, intervalMs, refresh]);

  return { ...state, refresh };
}
