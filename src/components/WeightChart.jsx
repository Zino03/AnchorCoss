// 중량 그래프 (DESIGN.md 5장): 좌/우/합계 선, 합계 기준 1·2·3단계(주의·중간·위험) 점선, 우천 구간 배경, 상태 전환 세로선
// 실물 센서는 1초 간격이라 1시간이 3600점 → 그래프에는 최대 MAX_POINTS개로 줄여 그린다 (구간 평균)

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { TH } from "../config.js";
import { COLORS } from "../ui/colors.js";
import { toChartData, downsample, rainSegments, fmtHM, fmtTime, fmtG } from "../ui/format.js";

const NAMES = { left: "좌", right: "우", total: "합계" };
const MAX_POINTS = 400;

export function WeightChart({ history, transitions }) {
  const data = downsample(toChartData(history, { maxG: TH.MAX_VALID_G }), MAX_POINTS);
  if (data.length < 2) return <p className="muted chart-empty">데이터 수집 중…</p>;

  const from = data[0].ts;
  const to = data[data.length - 1].ts;
  const maxTotal = Math.max(0, ...data.map((d) => d.total ?? 0));
  const yMax = Math.ceil(Math.max(TH.DANGER_TOTAL_G * 1.2, maxTotal * 1.1) / 100) * 100;
  const rain = rainSegments(data, TH.RAIN_MM_H);
  const marks = transitions.filter((t) => t.ts >= from && t.ts <= to);

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          {rain.map((seg) => (
            <ReferenceArea key={seg.from} x1={seg.from} x2={seg.to} fill={COLORS.rain} fillOpacity={0.7} ifOverflow="hidden" />
          ))}
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={[from, to]}
            tickFormatter={fmtHM}
            stroke={COLORS.axis}
            fontSize={12}
            minTickGap={40}
          />
          <YAxis domain={[0, yMax]} stroke={COLORS.axis} fontSize={12} width={52} tickFormatter={(v) => `${v}g`} />
          <ReferenceLine y={TH.WARN_TOTAL_G} stroke={COLORS.warn} strokeDasharray="5 4" label={{ value: "1단계·주의", position: "insideTopLeft", fill: COLORS.warnText, fontSize: 11 }} />
          <ReferenceLine y={TH.MID_TOTAL_G} stroke={COLORS.axis} strokeDasharray="2 4" label={{ value: "2단계", position: "insideTopLeft", fill: COLORS.axis, fontSize: 11 }} />
          <ReferenceLine y={TH.DANGER_TOTAL_G} stroke={COLORS.danger} strokeDasharray="5 4" label={{ value: "3단계·위험(수거)", position: "insideTopLeft", fill: COLORS.dangerText, fontSize: 11 }} />
          {marks.map((m) => (
            <ReferenceLine key={m.id} x={m.ts} stroke={COLORS[m.to]} strokeOpacity={0.6} />
          ))}
          <Tooltip
            labelFormatter={(ts) => fmtTime(ts)}
            formatter={(v, key) => [fmtG(v), NAMES[key] ?? key]}
            isAnimationActive={false}
          />
          <Line type="monotone" dataKey="left" stroke={COLORS.left} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line type="monotone" dataKey="right" stroke={COLORS.right} dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line type="monotone" dataKey="total" stroke={COLORS.total} dot={false} strokeWidth={2.5} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <ul className="chart-legend">
        <li><span className="swatch" style={{ background: COLORS.left }} />좌</li>
        <li><span className="swatch" style={{ background: COLORS.right }} />우</li>
        <li><span className="swatch is-thick" style={{ background: COLORS.total }} />합계</li>
        <li><span className="swatch is-area" style={{ background: COLORS.rain }} />우천 구간</li>
        <li><span className="swatch is-vline" />상태 전환 시점</li>
      </ul>
    </div>
  );
}
