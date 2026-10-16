import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import world from "world-atlas/countries-110m.json";
import { alpha2ToNumeric, countryName, flag } from "../../lib/countries";
import { formatMoney, formatNumber } from "../../lib/format";

export interface CountryDatum {
  country: string;
  count: number;
  volume: number;
  highRisk: boolean;
  flagged?: number;
}

const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
const countries = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;

export const WorldMap = ({ data, currency, highRiskList = [] }: { data: CountryDatum[]; currency?: string; highRiskList?: string[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<{ x: number; y: number; name: string; datum?: CountryDatum; listed: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.round(width * 0.5);
  const path = useMemo(() => {
    const projection = d3.geoNaturalEarth1().fitExtent([[8, 8], [width - 8, height - 8]], { type: "Sphere" });
    return d3.geoPath(projection);
  }, [width, height]);

  const byNumeric = useMemo(() => {
    const m = new Map<string, CountryDatum>();
    data.forEach((d) => {
      const n = alpha2ToNumeric(d.country);
      if (n) m.set(n, d);
    });
    return m;
  }, [data]);
  const listedNumeric = useMemo(() => new Set(highRiskList.map((c) => alpha2ToNumeric(c)).filter(Boolean) as string[]), [highRiskList]);

  const maxVolume = Math.max(1, ...data.map((d) => d.volume));
  const scale = d3.scaleSequentialLog([1, maxVolume], d3.interpolateRgb("#0d3b2c", "#00ff9d"));

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} className="block">
        <path d={path({ type: "Sphere" }) || ""} fill="#080b10" stroke="rgba(255,255,255,0.06)" />
        <path d={path(d3.geoGraticule10()) || ""} fill="none" stroke="rgba(255,255,255,0.035)" />
        {countries.features.map((f: Feature<Geometry, { name: string }>) => {
          const id = String(f.id).padStart(3, "0");
          const datum = byNumeric.get(id);
          const listed = listedNumeric.has(id);
          const fill = datum ? (datum.highRisk ? "#ff4d6d" : scale(Math.max(1, datum.volume))) : listed ? "rgba(255,77,109,0.12)" : "#151c27";
          return (
            <path
              key={id + f.properties.name}
              d={path(f) || ""}
              fill={fill}
              fillOpacity={datum ? 0.9 : 1}
              stroke={datum?.highRisk ? "#ff8fa3" : listed ? "rgba(255,77,109,0.4)" : "#05070a"}
              strokeWidth={datum?.highRisk ? 1 : 0.5}
              className="transition-opacity hover:opacity-80"
              onMouseMove={(e) => {
                const rect = ref.current!.getBoundingClientRect();
                setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, name: f.properties.name, datum, listed });
              }}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 min-w-[160px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-white/10 bg-ink-850/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="font-semibold text-white">
            {hover.datum ? `${flag(hover.datum.country)} ${countryName(hover.datum.country)}` : hover.name}
          </div>
          {hover.datum ? (
            <div className="mt-1 space-y-0.5 text-slate-400">
              <div>{formatNumber(hover.datum.count)} transfers · {formatMoney(hover.datum.volume, currency, true)}</div>
              {hover.datum.highRisk && <div className="font-semibold text-sev-critical">High-risk jurisdiction</div>}
            </div>
          ) : (
            <div className="mt-0.5 text-slate-500">{hover.listed ? "High-risk jurisdiction · no activity" : "No activity"}</div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-2">
          Volume
          <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg,#0d3b2c,#00ff9d)" }} />
        </span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sev-critical" /> High-risk with activity</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-sev-critical/40 bg-sev-critical/10" /> Monitored jurisdiction</span>
      </div>
    </div>
  );
};
