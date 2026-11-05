import { STATE_META, FLAG_LABEL, FLAGS } from "../logic/states.js";

/**
 * 상태 뱃지: 아이콘 + 라벨 (색만으로 구분하지 않음, DESIGN.md 3장)
 * @param {{ state: string, pending?: string|null, pulse?: boolean }} props
 */
export function StateBadge({ state, pending = null, pulse = false }) {
  const meta = STATE_META[state];
  if (!meta) return null;
  return (
    <span className={`badge st-${state}${pulse && state === "danger" ? " pulse" : ""}`}>
      <span className="badge-icon" aria-hidden="true">
        {meta.icon}
      </span>
      {meta.label}
      {pending && <span className="badge-pending">· {STATE_META[pending].label} 확인 중</span>}
    </span>
  );
}

/** 보조 플래그 태그 묶음 (우천 중만 강조색) */
export function FlagTags({ flags }) {
  if (!flags?.length) return null;
  return (
    <span className="tags">
      {flags.map((f) => (
        <span key={f} className={`tag${f === FLAGS.RAINING ? " is-rain" : ""}`}>
          {FLAG_LABEL[f]}
        </span>
      ))}
    </span>
  );
}
