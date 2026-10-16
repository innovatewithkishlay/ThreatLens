import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatNumber, SEVERITY, SEVERITY_ORDER } from "../../lib/format";
import type { Severity } from "../../lib/types";

const axis = { stroke: "#334155", fontSize: 11, tickLine: false, axisLine: false } as const;

const TooltipBox = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-white/10 bg-ink-850/95 px-3 py-2 text-xs shadow-xl backdrop-blur">{children}</div>
);

export const ActivityChart = ({
  data,
  currency,
  height = 280,
}: {
  data: { date: string; count: number; volume: number; flagged: number }[];
  currency?: string;
  height?: number;
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff9d" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#00ff9d" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
      <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })} minTickGap={24} />
      <YAxis yAxisId="v" {...axis} width={56} tickFormatter={(v: number) => formatMoney(v, undefined, true)} />
      <YAxis yAxisId="c" orientation="right" {...axis} width={30} allowDecimals={false} />
      <Tooltip
        cursor={{ stroke: "rgba(0,255,157,0.3)" }}
        content={({ active, payload, label }) =>
          active && payload?.length ? (
            <TooltipBox>
              <div className="mb-1 font-semibold text-white">{new Date(label as string).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</div>
              <div className="text-slate-400">Volume <span className="float-right ml-4 text-accent">{formatMoney(payload[0].payload.volume, currency)}</span></div>
              <div className="text-slate-400">Transfers <span className="float-right ml-4 text-white">{payload[0].payload.count}</span></div>
              <div className="text-slate-400">Flagged <span className="float-right ml-4 text-sev-critical">{payload[0].payload.flagged}</span></div>
            </TooltipBox>
          ) : null
        }
      />
      <Area yAxisId="v" type="monotone" dataKey="volume" stroke="#00ff9d" strokeWidth={2} fill="url(#vol)" />
      <Bar yAxisId="c" dataKey="flagged" fill="#ff4d6d" fillOpacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={14} />
      <Line yAxisId="c" type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
    </ComposedChart>
  </ResponsiveContainer>
);

export const HourlyChart = ({ data, offHours = [0, 4], height = 220 }: { data: number[]; offHours?: [number, number]; height?: number }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data.map((count, hour) => ({ hour, count }))} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
      <XAxis dataKey="hour" {...axis} tickFormatter={(h: number) => `${String(h).padStart(2, "0")}h`} interval={2} />
      <YAxis {...axis} allowDecimals={false} />
      <Tooltip
        cursor={{ fill: "rgba(255,255,255,0.04)" }}
        content={({ active, payload }) =>
          active && payload?.length ? (
            <TooltipBox>
              <span className="text-white">{String(payload[0].payload.hour).padStart(2, "0")}:00 – {String(payload[0].payload.hour).padStart(2, "0")}:59</span>
              <span className="ml-3 text-accent">{payload[0].payload.count} transfers</span>
            </TooltipBox>
          ) : null
        }
      />
      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
        {data.map((_, h) => (
          <Cell key={h} fill={h >= offHours[0] && h <= offHours[1] ? "#facc15" : "#00ff9d"} fillOpacity={h >= offHours[0] && h <= offHours[1] ? 0.85 : 0.6} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export const SeverityDonut = ({ counts, size = 180 }: { counts: Record<Severity, number>; size?: number }) => {
  const data = SEVERITY_ORDER.map((s) => ({ name: SEVERITY[s].label, value: counts[s] || 0, color: SEVERITY[s].color })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={total ? data : [{ name: "None", value: 1, color: "#1f2836" }]} dataKey="value" innerRadius="70%" outerRadius="100%" paddingAngle={total > 1 ? 3 : 0} stroke="none" startAngle={90} endAngle={-270}>
            {(total ? data : [{ color: "#1f2836" }]).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-white">{formatNumber(total)}</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">findings</span>
      </div>
    </div>
  );
};

export const HorizontalBars = ({
  data,
  valueFormat = (v: number) => formatNumber(v),
  color = "#00ff9d",
}: {
  data: { label: string; value: number; color?: string; hint?: string }[];
  valueFormat?: (v: number) => string;
  color?: string;
}) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-slate-300" title={d.hint}>{d.label}</span>
            <span className="shrink-0 font-mono text-xs text-slate-400">{valueFormat(d.value)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color || color }} />
          </div>
        </div>
      ))}
    </div>
  );
};
