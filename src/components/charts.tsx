"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthDayLabel } from "@/lib/time";
import { pct } from "@/lib/utils";
import type { ModelReport, Split } from "@/lib/types";

const AXIS = "#5d6b86";
const GRID = "rgba(255,255,255,0.06)";

const tooltipStyle = {
  background: "#0b1220",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e6ecf8",
  boxShadow: "0 18px 40px -20px rgba(0,0,0,0.9)",
} as const;

export function FatigueTrendChart({
  data,
  height = 220,
}: {
  data: { date: string; fatigue: number; miles: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id="fatigueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#52e5b0" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#52e5b0" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => monthDayLabel(v)}
            stroke={AXIS}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis domain={[0, 100]} stroke={AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => monthDayLabel(String(v))}
            formatter={(value, name) =>
              [
                name === "fatigue" ? `${value}/100` : `${Number(value ?? 0).toLocaleString()} mi`,
                name === "fatigue" ? "Fatigue index" : "Miles (7d)",
              ] as [string, string]
            }
          />
          <ReferenceLine y={60} stroke="rgba(255,203,107,0.35)" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="fatigue"
            stroke="#52e5b0"
            strokeWidth={2}
            fill="url(#fatigueFill)"
            isAnimationActive={false}
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SplitBars({
  splits,
  height = 220,
}: {
  splits: Split[];
  height?: number;
}) {
  const data = splits.map((s) => ({
    label: s.label,
    pts: s.pts,
    ci: s.ci,
    n: s.n,
    low: Math.max(0, s.pts - s.ci),
    high: s.pts + s.ci,
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, bottom: 0, left: 4 }} barCategoryGap={8}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" stroke={AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, "auto"]} />
          <YAxis
            type="category"
            dataKey="label"
            width={104}
            stroke={AXIS}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name, item) => {
              const payload = item?.payload as { ci?: number; n?: number } | undefined;
              return [
                `${Number(value ?? 0).toFixed(1)} pts ± ${(payload?.ci ?? 0).toFixed(1)} (n=${payload?.n ?? 0})`,
                "Points",
              ] as [string, string];
            }}
          />
          <Bar dataKey="pts" radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={index % 2 === 0 ? "#52e5b0" : "#7d92ff"} fillOpacity={0.75} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CalibrationChart({ report, height = 240 }: { report: ModelReport; height?: number }) {
  const data = report.calibration.map((b) => ({
    label: b.bucket,
    predicted: Math.round(b.predicted * 100),
    observed: Math.round(b.observed * 100),
    n: b.count,
  }));

  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-mist-500">Not enough completed games to calibrate yet.</p>;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis dataKey="label" stroke={AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} stroke={AXIS} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name, item) => {
              const payload = item?.payload as { n?: number } | undefined;
              return [
                `${value}% (n=${payload?.n ?? 0})`,
                name === "predicted" ? "Predicted" : "Observed",
              ] as [string, string];
            }}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#5d6b86"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="observed"
            stroke="#52e5b0"
            strokeWidth={2}
            dot={{ r: 3, fill: "#52e5b0" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MiniBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1.5" aria-hidden>
      {values.map((v, i) => (
        <div key={labels[i]} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-sm bg-mint-400/70"
            style={{ height: `${Math.max(4, (v / max) * 44)}px` }}
          />
          <span className="text-[9px] text-mist-600">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function ProbabilitySplit({
  home,
  away,
  homeColor,
  awayColor,
  homePct,
}: {
  home: string;
  away: string;
  homePct: number;
  homeColor: string;
  awayColor: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-mist-500">
        <span>
          {away} {pct(1 - homePct, 0)}
        </span>
        <span>
          {home} {pct(homePct, 0)}
        </span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <span style={{ width: `${(1 - homePct) * 100}%`, background: awayColor }} />
        <span style={{ width: `${homePct * 100}%`, background: homeColor }} />
      </div>
    </div>
  );
}
