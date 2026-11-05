// 실시간 모드의 기상청 실황 표시: 지역 · 기온 · 강수 형태 · 강수량 · 관측 시각 · 새로고침
// 실패 시: 직전 값이 있으면 ⚠ 표시와 함께 유지, 없으면 오류 문구 + 재시도

const fmtBase = (d, t) => (d && t ? `${t.slice(0, 2)}:${t.slice(2)} 관측` : "");

export function WeatherInfo({ weather }) {
  const { data, error, loading, refresh } = weather;

  if (!data) {
    return (
      <span className="weather-info" role="status">
        {loading || !error ? (
          <span className="muted">기상청 불러오는 중…</span>
        ) : (
          <>
            <span className="tx-danger weather-error" title={error}>
              기상청 연결 실패
            </span>
            <button className="btn" onClick={refresh}>
              재시도
            </button>
          </>
        )}
      </span>
    );
  }

  const raining = data.rainMm > 0 || data.pty !== 0;
  return (
    <span className="weather-info" role="status" title={`${data.region} · 격자 ${data.nx},${data.ny} · 습도 ${data.humidity ?? "—"}% · 풍속 ${data.windMs ?? "—"}m/s`}>
      <span aria-hidden="true">{raining ? "☂" : "☀"}</span>
      <span className="weather-region">{data.region}</span>
      <span className="num">{data.tempC != null ? `${data.tempC}℃` : "—"}</span>
      <span className={`tag${raining ? " is-rain" : ""}`}>
        {data.ptyLabel} · <span className="num">{data.rainMm}mm/h</span>
      </span>
      <span className="muted num">{fmtBase(data.baseDate, data.baseTime)}</span>
      {error && (
        <span className="tx-warn" title={`최근 갱신 실패: ${error}`} aria-label={`최근 갱신 실패: ${error}`}>
          ⚠
        </span>
      )}
      <button className="btn weather-refresh" onClick={refresh} disabled={loading} aria-label="기상 정보 새로고침">
        {loading ? "…" : "↻"}
      </button>
    </span>
  );
}
