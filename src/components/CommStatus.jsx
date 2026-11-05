// 통신 상태 (DESIGN.md 5장): 마지막 수신 · 신호 세기 · 배터리. 두절 시 회색 + 점검 필요
import { STATES, CHECK_CAUSE } from "../logic/states.js";
import { fmtAgo, rssiLevel } from "../ui/format.js";

export function CommStatus({ station, now }) {
  const s = station.latest;
  const j = station.judgement;
  const stale = j.state === STATES.CHECK && j.checkCause === CHECK_CAUSE.STALE;
  const level = stale ? 0 : rssiLevel(s?.rssi);

  return (
    <div className={`comm${stale ? " is-stale" : ""}`}>
      {stale && <p className="comm-alert">점검 필요 — 마지막 수신 {fmtAgo(now, s?.ts)}</p>}
      <dl className="comm-grid">
        <div>
          <dt>마지막 수신</dt>
          <dd className="num">{fmtAgo(now, s?.ts)}</dd>
        </div>
        <div>
          <dt>신호 세기</dt>
          <dd className="num">
            <span className="rssi" aria-label={`신호 ${level}/4`}>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={`rssi-bar${n <= level ? " is-on" : ""}`} style={{ height: `${n * 25}%` }} />
              ))}
            </span>
            {s ? `${s.rssi} dBm` : "—"}
          </dd>
        </div>
        <div>
          <dt>배터리</dt>
          <dd className={`num${s && s.batteryPct < 20 ? " tx-danger" : ""}`}>{s ? `${s.batteryPct}%` : "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
