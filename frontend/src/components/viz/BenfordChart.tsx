import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BenfordResult } from "../../lib/types";

const CONFORMITY = {
  close: { label: "Close conformity", cls: "text-accent" },
  acceptable: { label: "Acceptable conformity", cls: "text-accent" },
  marginal: { label: "Marginal conformity", cls: "text-sev-medium" },
  nonconformity: { label: "Nonconformity", cls: "text-sev-critical" },
};

export const BenfordChart = ({ data, minCount = 300 }: { data: BenfordResult; minCount?: number }) => {
  const rows = data.digits.map((d) => ({ digit: String(d.digit), observed: +(d.observed * 100).toFixed(1), expected: +(d.expected * 100).toFixed(1), count: d.count }));
  const c = CONFORMITY[data.conformity];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className={data.applicable ? c.cls : "text-slate-400"}>{data.applicable ? c.label : "Indicative only"}</span>
        <span className="font-mono text-xs text-slate-500">MAD {data.mad.toFixed(4)} · n = {data.n.toLocaleString()}</span>
        {!data.applicable && <span className="text-xs text-slate-500">Needs ≥ {minCount} amounts for a reliable test</span>}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={rows} margin={{ top: 5, right: 0, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="digit" stroke="#334155" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#334155" fontSize={11} tickLine={false} axisLine={false} unit="%" />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-xl border border-white/10 bg-ink-850/95 px-3 py-2 text-xs shadow-xl">
                  <div className="font-semibold text-white">Leading digit {payload[0].payload.digit}</div>
                  <div className="text-slate-400">Observed <span className="ml-3 text-accent">{payload[0].payload.observed}%</span> ({payload[0].payload.count})</div>
                  <div className="text-slate-400">Benford <span className="ml-3 text-sev-medium">{payload[0].payload.expected}%</span></div>
                </div>
              ) : null
            }
          />
          <Bar dataKey="observed" fill="#00ff9d" fillOpacity={0.55} radius={[4, 4, 0, 0]} />
          <Line dataKey="expected" stroke="#facc15" strokeWidth={2} dot={{ r: 3, fill: "#facc15" }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-slate-500">
        Bars: share of amounts by first digit. Line: Benford's law. Large gaps can reveal invented or manipulated amounts.
      </p>
    </div>
  );
};
