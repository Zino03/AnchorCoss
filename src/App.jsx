// 대시보드 레이아웃 (docs/DESIGN.md 4장)
// useSimulation()은 여기서 한 번만 호출하고, 하위 컴포넌트에는 props로 내려준다.
import { useState } from "react";
import { useSimulation } from "./sim/useSimulation.js";
import { TopBar } from "./components/TopBar.jsx";
import { Summary } from "./components/Summary.jsx";
import { PriorityList } from "./components/PriorityList.jsx";
import { MapView } from "./components/MapView.jsx";
import { DrainDetail } from "./components/DrainDetail.jsx";

export default function App() {
  const sim = useSimulation();
  const [selectedId, setSelectedId] = useState(() => sim.stations[0]?.id ?? null);
  const selected = sim.stations.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="app">
      <TopBar sim={sim} selected={selected} />

      {/* F6: 위험 배너·토스트 영역 */}
      <div className="alert-area" />

      <div className="layout">
        <aside className="layout-side">
          <Summary />
          <PriorityList stations={sim.stations} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <main className="layout-main">
          <MapView />
          <DrainDetail station={selected} />
        </main>
      </div>
    </div>
  );
}
