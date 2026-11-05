// 대시보드 레이아웃 (docs/DESIGN.md 4장)
// useSimulation()은 여기서 한 번만 호출하고, 하위 컴포넌트에는 props로 내려준다.
import { useEffect, useState } from "react";
import { useSimulation } from "./sim/useSimulation.js";
import { useWeather } from "./sim/useWeather.js";
import { TopBar } from "./components/TopBar.jsx";
import { Summary } from "./components/Summary.jsx";
import { PriorityList } from "./components/PriorityList.jsx";
import { MapView } from "./components/MapView.jsx";
import { DrainDetail } from "./components/DrainDetail.jsx";
import { Alerts } from "./components/Toasts.jsx";
import { sortByPriority } from "./ui/format.js";

export default function App() {
  const sim = useSimulation();
  // 처음에는 우선순위 1위 지점을 선택
  const [selectedId, setSelectedId] = useState(() => sortByPriority(sim.stations)[0]?.id ?? null);
  const selected = sim.stations.find((s) => s.id === selectedId) ?? null;

  // 강우 모드 — "sim": 시나리오 강우 + 수동 입력 / "live": 기상청 실측 강우를 모든 지점에 적용
  // (센서 값은 실물 연결 전까지 두 모드 모두 가상)
  const [rainMode, setRainMode] = useState("sim");
  const weather = useWeather({ enabled: rainMode === "live" });
  const liveRain = weather.data?.rainMm;

  useEffect(() => {
    if (rainMode === "live") {
      if (liveRain != null) sim.setRain(liveRain);
    } else {
      sim.setRain(null);
    }
    // runId: "처음부터"로 시뮬레이터가 새로 만들어져도 실시간 강우를 다시 적용
  }, [rainMode, liveRain, sim.runId, sim.setRain]);

  return (
    <div className="app">
      {/* 상단바 + 위험 배너는 스크롤해도 위에 고정 */}
      <div className="sticky-head">
        <TopBar sim={sim} rainMode={rainMode} onRainMode={setRainMode} weather={weather} />
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
