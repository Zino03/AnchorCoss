// 상태 전환 타임라인 (DESIGN.md 5장): 시각 · 이전 → 이후 · 사유 (최신순, 최대 20건)
import { StateBadge } from "./StateBadge.jsx";
import { fmtTime } from "../ui/format.js";

export function Timeline({ transitions }) {
  if (!transitions.length) return <p className="muted">상태 전환 기록 없음</p>;
  return (
    <ol className="timeline">
      {transitions.map((t) => (
        <li key={t.id} className="timeline-row">
          <span className="timeline-time num muted">{fmtTime(t.ts)}</span>
          <span className="timeline-change">
            <StateBadge state={t.from} />
            <span aria-label="에서" className="muted">→</span>
            <StateBadge state={t.to} />
          </span>
          <span className="timeline-reason">{t.reason}</span>
        </li>
      ))}
    </ol>
  );
}
