import { StateBadge } from "./StateBadge.jsx";
import { STATES, FLAGS } from "../logic/states.js";
import { sortByPriority, fmtAgo } from "../ui/format.js";

/**
 * 수거 우선순위 목록 (DESIGN.md 5장 PriorityList)
 * 행: 순위 · 지점명 · 상태 뱃지 · 점수 막대 · 마지막 수신
 */
export function PriorityList({ stations, now, selectedId, onSelect }) {
  const sorted = sortByPriority(stations);
  return (
    <section className="card" aria-label="수거 우선순위">
      <div className="card-title">수거 우선순위</div>
      <ol className="plain-list">
        {sorted.map((s, i) => {
          const j = s.judgement;
          const isCheck = j.state === STATES.CHECK;
          const raining = j.flags.includes(FLAGS.RAINING);
          return (
            <li key={s.id}>
              <button
                className={`list-row prio-row${s.id === selectedId ? " is-selected" : ""}`}
                onClick={() => onSelect(s.id)}
                aria-pressed={s.id === selectedId}
              >
                <span className="prio-rank num">{isCheck ? "–" : i + 1}</span>
                <span className="prio-main">
                  <span className="prio-name">
                    {s.name}
                    {raining && <span className="tag is-rain">우천</span>}
                  </span>
                  <span className="prio-meta">
                    <StateBadge state={j.state} />
                    <span className="muted">{fmtAgo(s.clockNow ?? now, s.latest?.ts)}</span>
                  </span>
                </span>
                <span className="prio-score">
                  {isCheck ? (
                    <span className="muted">점검 필요</span>
                  ) : (
                    <>
                      <span className={`num tx-${j.state}`}>{j.score}</span>
                      <span className="score-bar" aria-hidden="true">
                        <span className={`score-fill st-${j.state}`} style={{ width: `${j.score}%` }} />
                      </span>
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
