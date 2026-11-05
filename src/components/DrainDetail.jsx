import { StateBadge, FlagTags } from "./StateBadge.jsx";

// F5에서 구현: 좌/우 게이지 · 중량 그래프 · 판정 근거 · 통신 상태 · 타임라인
export function DrainDetail({ station }) {
  if (!station) {
    return (
      <section className="card">
        <p className="muted">지점을 선택하세요.</p>
      </section>
    );
  }
  const j = station.judgement;
  return (
    <section className="card" aria-label={`${station.name} 상세`}>
      <div className="detail-head">
        <h2 className="detail-name">{station.name}</h2>
        <StateBadge state={j.state} pending={j.pending} pulse />
        <FlagTags flags={j.flags} />
      </div>
      <ul className="reason-list">
        {j.reason.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="muted">게이지·그래프·통신 상태·타임라인은 F5에서 구현</p>
    </section>
  );
}
