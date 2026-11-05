// 대시보드 레이아웃 (docs/DESIGN.md 4장)
// useSimulation()은 여기서 한 번만 호출하고, 하위 컴포넌트에는 props로 내려준다.
import { useCallback, useEffect, useState } from "react";
import { useSimulation } from "./sim/useSimulation.js";
import { useWeather } from "./sim/useWeather.js";
import { useSensorFeed } from "./sim/useSensorFeed.js";
import { DEFAULT_STATIONS } from "./sim/simulator.js";
import { TopBar } from "./components/TopBar.jsx";
import { Summary } from "./components/Summary.jsx";
import { PriorityList } from "./components/PriorityList.jsx";
import { MapView } from "./components/MapView.jsx";
import { DrainDetail } from "./components/DrainDetail.jsx";
import { Alerts } from "./components/Toasts.jsx";
import { sortByPriority } from "./ui/format.js";

// 실물 센서를 연결할 지점 (기본: 빗물받이 #1)
const REAL_STATION_ID = DEFAULT_STATIONS.find((s) => s.real)?.id ?? null;

export default function App() {
  const sim = useSimulation();
  // 처음에는 우선순위 1위 지점을 선택
  const [selectedId, setSelectedId] = useState(() => sortByPriority(sim.stations)[0]?.id ?? null);
  const selected = sim.stations.find((s) => s.id === selectedId) ?? null;

  // 데이터 모드
  //  "sim":  모든 지점 가상, 강우는 시나리오 또는 수동 입력
  //  "live": 강우는 기상청 실측(모든 지점), 실물 지점(#1)은 서버에 저장된 센서 데이터, 나머지 지점은 가상
  const [mode, setMode] = useState("sim");
  const live = mode === "live";

  const weather = useWeather({ enabled: live });
  const liveRain = weather.data?.rainMm;
  useEffect(() => {
    if (live) {
      if (liveRain != null) sim.setRain(liveRain);
    } else {
      sim.setRain(null);
    }
    // runId: "처음부터"로 시뮬레이터가 새로 만들어져도 다시 적용
  }, [live, liveRain, sim.runId, sim.setRain]);

  useEffect(() => {
    sim.setRealStations(live && REAL_STATION_ID ? [REAL_STATION_ID] : []);
  }, [live, sim.runId, sim.setRealStations]);

  const { ingestReal } = sim;
  const onSamples = useCallback((samples, opt) => ingestReal(REAL_STATION_ID, samples, opt), [ingestReal]);
  const feed = useSensorFeed({ enabled: live, stationId: REAL_STATION_ID, onSamples, resetKey: sim.runId });
  const realStation = sim.stations.find((s) => s.id === REAL_STATION_ID) ?? null;

  return (
    <div className="app">
      {/* 상단바 + 위험 배너는 스크롤해도 위에 고정 */}
      <div className="sticky-head">
        <TopBar sim={sim} mode={mode} onMode={setMode} weather={weather} feed={feed} realStation={realStation} />
        {/* key=runId: "처음부터"를 누르면 알림 닫기 기록·토스트도 초기화 */}
        <Alerts key={sim.runId} stations={sim.stations} events={sim.events} onSelect={setSelectedId} />
      </div>

      <div className="layout">
        <aside className="layout-side">
          <Summary stations={sim.stations} />
          <PriorityList stations={sim.stations} now={sim.now} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <main className="layout-main">
          <MapView stations={sim.stations} selectedId={selectedId} onSelect={setSelectedId} />
          <DrainDetail
            station={selected}
            now={sim.now}
            onCollect={sim.collect}
            onScenario={sim.setScenario}
          />
        </main>
      </div>
    </div>
  );
}
