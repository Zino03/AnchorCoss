import { StateBadge } from "./StateBadge.jsx";

// F3에서 구현: 막힘 점수순 정렬·점수 막대. 지금은 선택 동작 확인용 단순 목록.
export function PriorityList({ stations, selectedId, onSelect }) {
  return (
    <section className="card" aria-label="수거 우선순위">
      <div className="card-title">수거 우선순위</div>
      <ul className="plain-list">
        {stations.map((s) => (
          <li key={s.id}>
            <button
              className={`list-row${s.id === selectedId ? " is-selected" : ""}`}
              onClick={() => onSelect(s.id)}
              aria-pressed={s.id === selectedId}
            >
              <span>{s.name}</span>
              <StateBadge state={s.judgement.state} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
