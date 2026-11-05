// 알림 (DESIGN.md 5장, 기획서 6장 4번 — 화면 배너/토스트만)
//
// 위험 배너: "지금 위험인 지점" 기준. 닫기 전까지 유지, 위험이 풀리면 자동 제거.
//            닫은 뒤 다시 위험이 되면(새 전환) 다시 뜬다. 최대 3개 + "외 N곳".
// 토스트:    상태 전환 이벤트 중 주의/정상 복귀/점검 필요. 5초 뒤 자동으로 사라짐. 최대 3개.

import { useEffect, useRef, useState } from "react";
import { STATES, STATE_META, FLAGS } from "../logic/states.js";
import { sortByPriority } from "../ui/format.js";

const MAX_BANNERS = 3;
const MAX_TOASTS = 3;
const TOAST_MS = 5000;

const TOAST_TEXT = {
  [STATES.WARN]: (from) => (from === STATES.DANGER ? "주의로 완화" : "주의 단계 진입"),
  [STATES.NORMAL]: () => "정상 복귀",
  [STATES.CHECK]: () => "점검 필요",
};

/** 배너 닫기 키: 같은 위험 구간 동안은 같은 키 → 새로 위험이 되면 다시 뜬다 */
function bannerKey(s) {
  const t = s.transitions.find((x) => x.to === STATES.DANGER);
  return `${s.id}:${t?.id ?? "init"}`;
}

export function Alerts({ stations, events, onSelect }) {
  const [dismissed, setDismissed] = useState(() => new Set());
  const [toasts, setToasts] = useState([]);
  const seen = useRef(new Set());
  const timers = useRef([]);
  const names = useRef({});
  for (const s of stations) names.current[s.id] = s.name;

  // 새 상태 전환 이벤트 → 토스트 (위험은 배너가 담당)
  useEffect(() => {
    const fresh = [];
    for (const ev of events) {
      if (seen.current.has(ev.id)) continue;
      seen.current.add(ev.id);
      if (ev.to !== STATES.DANGER && TOAST_TEXT[ev.to]) fresh.push(ev);
    }
    if (!fresh.length) return;
    setToasts((prev) => [...fresh, ...prev].slice(0, MAX_TOASTS));
    for (const ev of fresh) {
      timers.current.push(setTimeout(() => setToasts((p) => p.filter((t) => t.id !== ev.id)), TOAST_MS));
    }
  }, [events]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const banners = sortByPriority(stations)
    .filter((s) => s.judgement.state === STATES.DANGER)
    .map((s) => ({ s, key: bannerKey(s) }))
    .filter((b) => !dismissed.has(b.key));
  const shown = banners.slice(0, MAX_BANNERS);
  const more = banners.length - shown.length;

  const dismiss = (key) => setDismissed((prev) => new Set(prev).add(key));
  const closeToast = (id) => setToasts((p) => p.filter((t) => t.id !== id));

  return (
    <>
      {shown.length > 0 && (
        <div className="banners">
          {shown.map(({ s, key }) => {
            const raining = s.judgement.flags.includes(FLAGS.RAINING);
            return (
              <div key={key} className={`banner${raining ? " is-rain" : ""}`} role="alert">
                <span className="banner-icon" aria-hidden="true">
                  ⚠
                </span>
                <div className="banner-text">
                  <strong>
                    {s.name} — 수거 필요{raining && " (우천 중)"}
                  </strong>
                  <span className="banner-reason">{s.judgement.reason[0]}</span>
                </div>
                <button className="btn" onClick={() => onSelect(s.id)}>
                  지점 보기
                </button>
                <button className="banner-close" onClick={() => dismiss(key)} aria-label={`${s.name} 알림 닫기`}>
                  ✕
                </button>
              </div>
            );
          })}
          {more > 0 && <p className="banner-more">외 {more}곳 위험 — 수거 우선순위 목록을 확인하세요.</p>}
        </div>
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast st-${t.to}`} role="status">
            <span className="toast-icon" aria-hidden="true">
              {STATE_META[t.to].icon}
            </span>
            <button className="toast-body" onClick={() => onSelect(t.stationId)} title="지점 보기">
              <strong>
                {names.current[t.stationId] ?? t.stationId} · {TOAST_TEXT[t.to](t.from)}
              </strong>
              <span className="toast-reason">{t.reason}</span>
            </button>
            <button className="toast-close" onClick={() => closeToast(t.id)} aria-label="알림 닫기">
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
