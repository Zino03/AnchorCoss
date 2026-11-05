// 실시간 모드의 실물 센서 수신 상태: 서버 연결 / 데이터 수신 여부
import { fmtAgo } from "../ui/format.js";

export function SensorFeedBadge({ feed, station }) {
  if (!feed || feed.status === "off") return null;

  if (feed.status === "error") {
    return (
      <span className="tag feed-badge is-error" role="status" title={feed.error}>
        센서 서버 연결 실패
      </span>
    );
  }
  if (feed.status === "connecting") {
    return <span className="tag feed-badge">센서 서버 연결 중…</span>;
  }

  const last = station?.latest?.ts;
  return (
    <span
      className={`tag feed-badge${last ? " is-ok" : ""}`}
      role="status"
      title={`${station?.name ?? "실물 지점"} — 서버에 저장된 센서 데이터를 3초마다 확인합니다`}
    >
      {last ? `실물 센서 · ${fmtAgo(station.clockNow, last)} 수신` : "실물 센서 · 수신 대기"}
    </span>
  );
}
