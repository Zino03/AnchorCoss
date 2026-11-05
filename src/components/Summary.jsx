import { STATES, STATE_META } from "../logic/states.js";
import { countByState } from "../ui/format.js";

const ORDER = [STATES.NORMAL, STATES.WARN, STATES.DANGER, STATES.CHECK];
const SHORT = { normal: "정상", warn: "주의", danger: "위험", check: "점검 필요" };

/** 상태별 지점 수 카드 4칸 (DESIGN.md 5장 Summary) */
export function Summary({ stations }) {
  const counts = countByState(stations);
  return (
    <section className="card" aria-label="상태 요약">
      <div className="card-title">
        상태 요약 <span className="muted">· 전체 {stations.length}개 지점</span>
      </div>
      <div className="summary-grid">
        {ORDER.map((st) => {
          const n = counts[st];
          const alert = st === STATES.DANGER && n > 0;
          return (
            <div key={st} className={`summary-cell st-${st}${alert ? " pulse" : ""}`}>
              <span className="summary-label">
                <span aria-hidden="true">{STATE_META[st].icon}</span> {SHORT[st]}
              </span>
              <span className="summary-num num">{n}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
