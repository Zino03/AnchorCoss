// 화면에서 쓰는 단 하나의 훅. 프론트는 이 훅의 반환값만 보고 그리면 된다.
//
// const sim = useSimulation();
// sim.stations     Station[] (types.js) — 지점별 최신 샘플·이력·판정·전환 이력
// sim.events       최근 상태 전환 이벤트 (최신순, 최대 50) — 배너/토스트용 { id, stationId, ts, from, to, reason }
// sim.now          시뮬레이션 현재 시각 (epoch ms)
// sim.playing / setPlaying(bool)   재생·일시정지
// sim.speed / setSpeed(n)          배속 (1틱 = 10초, 1× = 실제 1초마다 1틱)
// sim.rainOverride / setRain(mm|null)  강우 수동 입력 (null = 시나리오 값)
// sim.collect(stationId)           수거(리셋)
// sim.setScenario(stationId, scenarioId)
// sim.step()                       일시정지 중 한 틱 진행
// sim.reset()                      처음부터 다시

import { useCallback, useEffect, useRef, useState } from "react";
import { createEngine } from "./engine.js";
import { createSimulator } from "./simulator.js";

const EVENT_LIMIT = 50;

function makeEngine(seed, warmupSteps) {
  const engine = createEngine({ sim: createSimulator({ seed, startTs: Date.now() }) });
  for (let i = 0; i < warmupSteps; i++) engine.step(); // 시작부터 그래프가 비어 있지 않게
  return engine;
}

/**
 * @param {Object} [opt]
 * @param {number} [opt.seed]        같은 seed면 시연마다 같은 흐름
 * @param {number} [opt.intervalMs]  실제 시간 기준 틱 간격
 * @param {number} [opt.warmupSteps] 시작 전에 미리 돌릴 틱 수 (기본 30 = 5분)
 */
export function useSimulation({ seed = 42, intervalMs = 1000, warmupSteps = 30 } = {}) {
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = makeEngine(seed, warmupSteps);

  const [snap, setSnap] = useState(() => engineRef.current.snapshot());
  const [events, setEvents] = useState([]);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  const advance = useCallback((n) => {
    const evs = [];
    for (let i = 0; i < n; i++) evs.push(...engineRef.current.step());
    setSnap(engineRef.current.snapshot());
    if (evs.length) setEvents((prev) => [...evs.reverse(), ...prev].slice(0, EVENT_LIMIT));
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    const h = setInterval(() => advance(speed), intervalMs);
    return () => clearInterval(h);
  }, [playing, speed, intervalMs, advance]);

  /** 엔진 조작 후 즉시 화면 반영 */
  const act = useCallback((fn) => {
    fn(engineRef.current);
    setSnap(engineRef.current.snapshot());
  }, []);

  return {
    ...snap,
    events,
    playing,
    setPlaying,
    speed,
    setSpeed,
    setRain: useCallback((mm) => act((e) => e.setRain(mm)), [act]),
    collect: useCallback((id) => act((e) => e.collect(id)), [act]),
    setScenario: useCallback((id, sc) => act((e) => e.setScenario(id, sc)), [act]),
    step: useCallback(() => advance(1), [advance]),
    reset: useCallback(() => {
      engineRef.current = makeEngine(seed, warmupSteps);
      setSnap(engineRef.current.snapshot());
      setEvents([]);
    }, [seed, warmupSteps]),
  };
}
