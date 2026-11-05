// 지도 (DESIGN.md 5장 MapView): Leaflet + 상태색 마커 + 목록과 선택 연동
// - Leaflet은 브라우저 전용이라 effect 안에서 동적으로 불러온다 (번들도 분리됨)
// - 타일은 OpenStreetMap. 인터넷이 없으면 배경만 비고 마커·선택은 그대로 동작한다.
// - 마커 DOM은 한 번 만들고 클래스만 바꾼다 (펄스 애니메이션이 매 틱 재시작되지 않게)

import { useEffect, useRef, useState } from "react";
import { MAP_CENTER } from "../config.js";
import { STATES, STATE_META } from "../logic/states.js";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MARKER_SIZE = 28;
const LEGEND = [STATES.NORMAL, STATES.WARN, STATES.DANGER, STATES.CHECK];
const SHORT = { normal: "정상", warn: "주의", danger: "위험", check: "점검 필요" };

export function MapView({ stations, selectedId, onSelect }) {
  const elRef = useRef(null);
  const ctxRef = useRef(null); // { L, map, markers: Map<id, L.Marker> }
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);

  // 지도 생성 (한 번)
  useEffect(() => {
    let disposed = false;
    import("leaflet").then(({ default: L }) => {
      if (disposed || !elRef.current) return;
      const map = L.map(elRef.current, { zoomControl: true }).setView(
        [MAP_CENTER.lat, MAP_CENTER.lng],
        MAP_CENTER.zoom,
      );
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(map);
      ctxRef.current = { L, map, markers: new Map(), fitted: false };
      setReady(true);
    });
    return () => {
      disposed = true;
      ctxRef.current?.map.remove();
      ctxRef.current = null;
    };
  }, []);

  // 마커 생성·갱신 (매 틱)
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ready || !ctx) return;
    const { L, map, markers } = ctx;

    for (const s of stations) {
      let m = markers.get(s.id);
      if (!m) {
        m = L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: "map-icon",
            html: '<div class="map-marker"></div>',
            iconSize: [MARKER_SIZE, MARKER_SIZE],
            iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
          }),
          keyboard: true, // Tab으로 포커스, Enter로 선택
          riseOnHover: true,
        }).addTo(map);
        m.on("click", () => onSelectRef.current(s.id));
        m.bindTooltip("", { direction: "top", offset: [0, -MARKER_SIZE / 2] });
        markers.set(s.id, m);
      }

      const st = s.judgement.state;
      const selected = s.id === selectedId;
      const el = m.getElement()?.querySelector(".map-marker");
      if (el) {
        el.className = `map-marker st-${st}${selected ? " is-selected" : ""}${st === STATES.DANGER ? " is-alert" : ""}`;
        el.textContent = STATE_META[st].icon;
      }
      m.setZIndexOffset(selected ? 1000 : st === STATES.DANGER ? 500 : 0);
      const score = s.judgement.score == null ? "" : ` · 점수 ${s.judgement.score}`;
      m.setTooltipContent(`<b>${s.name}</b><br>${STATE_META[st].label}${score}`);
      m.getElement()?.setAttribute("aria-label", `${s.name}, ${STATE_META[st].label}${score}`);
    }

    // 처음 한 번 모든 지점이 보이게
    if (!ctx.fitted && stations.length) {
      map.fitBounds(L.latLngBounds(stations.map((s) => [s.lat, s.lng])), { padding: [48, 48] });
      ctx.fitted = true;
    }
  }, [stations, selectedId, ready]);

  // 선택 지점이 화면 밖이면 이동
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ready || !ctx) return;
    const s = stations.find((x) => x.id === selectedId);
    if (s && !ctx.map.getBounds().pad(-0.1).contains([s.lat, s.lng])) ctx.map.panTo([s.lat, s.lng]);
    // stations는 매 틱 바뀌므로 의존성에서 일부러 제외 (선택이 바뀔 때만 이동)
  }, [selectedId, ready]);

  return (
    <section className="card map-card" aria-label="지점 지도">
      <div ref={elRef} className="map" />
      <ul className="map-legend" aria-label="범례">
        {LEGEND.map((st) => (
          <li key={st}>
            <span className={`legend-dot st-${st}`} aria-hidden="true">
              {STATE_META[st].icon}
            </span>
            {SHORT[st]}
          </li>
        ))}
      </ul>
    </section>
  );
}
