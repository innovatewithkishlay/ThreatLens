import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import clsx from "clsx";
import { FiMaximize, FiMinus, FiPlus } from "react-icons/fi";
import type { NetworkEdge, NetworkNode } from "../../lib/types";
import { formatMoney, riskColor } from "../../lib/format";

type SimNode = NetworkNode & d3.SimulationNodeDatum & { degree: number; volume: number };
type SimLink = d3.SimulationLinkDatum<SimNode> & NetworkEdge;

const MEMBERSHIP_COLOR = { A: "#00ff9d", B: "#22d3ee", both: "#f472b6" } as const;
const MAX_NODES = 350;

export interface NetworkGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  height?: number;
  colorMode?: "risk" | "membership";
  highlight?: string[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  currency?: string;
}

export const NetworkGraph = ({ nodes, edges, height = 560, colorMode = "risk", highlight, selected, onSelect, currency }: NetworkGraphProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [width, setWidth] = useState(800);
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const [hover, setHover] = useState<string | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the graph readable on very large cases: show the riskiest / busiest accounts.
  const { simNodes, simLinks, truncated } = useMemo(() => {
    const volume = new Map<string, number>();
    const degree = new Map<string, number>();
    for (const e of edges) {
      volume.set(e.from, (volume.get(e.from) || 0) + e.totalAmount);
      volume.set(e.to, (volume.get(e.to) || 0) + e.totalAmount);
      degree.set(e.from, (degree.get(e.from) || 0) + 1);
      degree.set(e.to, (degree.get(e.to) || 0) + 1);
    }
    let list = nodes;
    const truncated = nodes.length > MAX_NODES;
    if (truncated) {
      list = [...nodes].sort((a, b) => b.score - a.score || (volume.get(b.id) || 0) - (volume.get(a.id) || 0)).slice(0, MAX_NODES);
    }
    const keep = new Set(list.map((n) => n.id));
    const simNodes: SimNode[] = list.map((n) => ({ ...n, degree: degree.get(n.id) || 0, volume: volume.get(n.id) || 0 }));
    const simLinks: SimLink[] = edges.filter((e) => keep.has(e.from) && keep.has(e.to)).map((e) => ({ ...e, source: e.from, target: e.to }));

    const sim = d3
      .forceSimulation(simNodes)
      .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(95).strength(0.35))
      .force("charge", d3.forceManyBody().strength(-420))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => 10 + Math.sqrt(d.degree) * 3))
      .force("x", d3.forceX().strength(0.05))
      .force("y", d3.forceY().strength(0.07))
      .stop();
    sim.tick(Math.min(400, 120 + simNodes.length));
    return { simNodes, simLinks, truncated };
  }, [nodes, edges]);

  const maxAmount = useMemo(() => Math.max(1, ...simLinks.map((l) => l.totalAmount)), [simLinks]);
  const maxVolume = useMemo(() => Math.max(1, ...simNodes.map((n) => n.volume)), [simNodes]);
  const radius = (n: SimNode) => 5 + Math.sqrt(n.volume / maxVolume) * 14;

  const fit = () => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current || !simNodes.length) return;
    const xs = simNodes.map((n) => n.x || 0);
    const ys = simNodes.map((n) => n.y || 0);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const k = Math.min(1.4, 0.88 / Math.max((x1 - x0 + 60) / width, (y1 - y0 + 60) / height));
    const t = d3.zoomIdentity.translate(width / 2 - (k * (x0 + x1)) / 2, height / 2 - (k * (y0 + y1)) / 2).scale(k);
    d3.select(svg).transition().duration(500).call(zoomRef.current.transform, t);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 6])
      .on("zoom", (e) => setTransform(e.transform));
    zoomRef.current = zoom;
    d3.select(svg).call(zoom).on("dblclick.zoom", null);
    return () => {
      d3.select(svg).on(".zoom", null);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fit();
  }, [simNodes, width, height]);

  // Node dragging (d3-drag stops the event reaching the zoom handler).
  const scaleRef = useRef(1);
  scaleRef.current = transform.k;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const byId = new Map(simNodes.map((n) => [n.id, n]));
    const groups = d3.select(svg).selectAll<SVGGElement, SimNode>("g[data-node]");
    groups.each(function () {
      d3.select(this).datum(byId.get(this.dataset.node as string) as SimNode);
    });
    groups.call(
      d3.drag<SVGGElement, SimNode>().on("drag", (e, d) => {
        d.x = (d.x || 0) + e.dx / scaleRef.current;
        d.y = (d.y || 0) + e.dy / scaleRef.current;
        force((v) => v + 1);
      })
    );
    return () => {
      groups.on(".drag", null);
    };
  }, [simNodes]);

  const focus = hover || selected || null;
  const neighbours = useMemo(() => {
    if (!focus) return null;
    const set = new Set([focus]);
    simLinks.forEach((l) => {
      const s = (l.source as SimNode).id;
      const t = (l.target as SimNode).id;
      if (s === focus) set.add(t);
      if (t === focus) set.add(s);
    });
    return set;
  }, [focus, simLinks]);
  const highlightSet = useMemo(() => (highlight?.length ? new Set(highlight) : null), [highlight]);

  const nodeColor = (n: SimNode) => (colorMode === "membership" ? MEMBERSHIP_COLOR[n.membership || "A"] : riskColor(n.score));
  const isDim = (id: string) => (neighbours ? !neighbours.has(id) : highlightSet ? !highlightSet.has(id) : false);

  const hovered = hover ? simNodes.find((n) => n.id === hover) : null;

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl bg-ink-950/60" style={{ height }}>
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
      <svg ref={svgRef} width={width} height={height} className="relative cursor-grab active:cursor-grabbing" onClick={() => onSelect?.(null)}>
        <defs>
          {["#3b4a5e", "#ff4d6d", "#00ff9d"].map((c) => (
            <marker key={c} id={`arrow-${c.slice(1)}`} viewBox="0 -5 10 10" refX="10" refY="0" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,-5L10,0L0,5" fill={c} />
            </marker>
          ))}
        </defs>
        <g transform={transform.toString()}>
          {simLinks.map((l, i) => {
            const s = l.source as SimNode;
            const t = l.target as SimNode;
            const dx = (t.x || 0) - (s.x || 0);
            const dy = (t.y || 0) - (s.y || 0);
            const len = Math.hypot(dx, dy) || 1;
            const rt = radius(t) + 3;
            const x2 = (t.x || 0) - (dx / len) * rt;
            const y2 = (t.y || 0) - (dy / len) * rt;
            const active = focus && (s.id === focus || t.id === focus);
            const dim = focus ? !active : highlightSet ? !(highlightSet.has(s.id) && highlightSet.has(t.id)) : false;
            const color = active ? "#00ff9d" : l.flagged ? "#ff4d6d" : "#3b4a5e";
            // Curve reciprocal edges so both directions stay visible.
            const mx = ((s.x || 0) + x2) / 2 - (dy / len) * 14;
            const my = ((s.y || 0) + y2) / 2 + (dx / len) * 14;
            return (
              <path
                key={i}
                d={`M${s.x},${s.y} Q${mx},${my} ${x2},${y2}`}
                fill="none"
                stroke={color}
                strokeOpacity={dim ? 0.08 : l.flagged || active ? 0.85 : 0.5}
                strokeWidth={0.8 + (l.totalAmount / maxAmount) * 4}
                markerEnd={`url(#arrow-${color.slice(1)})`}
              />
            );
          })}
          {simNodes.map((n) => {
            const r = radius(n);
            const c = nodeColor(n);
            const dim = isDim(n.id);
            const isSel = selected === n.id;
            return (
              <g
                key={n.id}
                data-node={n.id}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-pointer"
                opacity={dim ? 0.18 : 1}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(n.id === selected ? null : n.id);
                }}
              >
                {(n.score >= 50 || isSel) && <circle r={r + 5} fill="none" stroke={isSel ? "#fff" : c} strokeOpacity={isSel ? 0.9 : 0.35} strokeWidth={isSel ? 2 : 1.5} />}
                <circle r={r} fill={c} fillOpacity={0.9} stroke="#05070a" strokeWidth={1.5} style={{ filter: n.score >= 50 ? `drop-shadow(0 0 6px ${c})` : undefined }} />
                {(transform.k > 0.6 || r > 12 || isSel || hover === n.id) && (
                  <text y={r + 4 + 11 / transform.k} textAnchor="middle" className="pointer-events-none select-none fill-slate-300 font-mono" fontSize={11 / transform.k}>
                    {n.id}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[240px] rounded-xl border border-white/10 bg-ink-850/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur">
          <div className="font-mono font-semibold text-white">{hovered.id}</div>
          {hovered.label !== hovered.id && <div className="text-slate-400">{hovered.label}</div>}
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-400">
            <span>Risk</span>
            <span className="text-right font-semibold" style={{ color: riskColor(hovered.score) }}>{hovered.score}</span>
            {hovered.inflow !== undefined && (
              <>
                <span>In</span>
                <span className="text-right text-slate-200">{formatMoney(hovered.inflow, currency, true)}</span>
                <span>Out</span>
                <span className="text-right text-slate-200">{formatMoney(hovered.outflow, currency, true)}</span>
              </>
            )}
            <span>Links</span>
            <span className="text-right text-slate-200">{hovered.degree}</span>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-850/90 backdrop-blur">
        {[
          { icon: <FiPlus />, label: "Zoom in", fn: () => svgRef.current && zoomRef.current && d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.4) },
          { icon: <FiMinus />, label: "Zoom out", fn: () => svgRef.current && zoomRef.current && d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.7) },
          { icon: <FiMaximize />, label: "Fit to view", fn: fit },
        ].map((b) => (
          <button key={b.label} onClick={b.fn} className="p-2.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white" aria-label={b.label} title={b.label}>
            {b.icon}
          </button>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-ink-850/90 px-3 py-2 text-[11px] text-slate-400 backdrop-blur">
        {colorMode === "risk" ? (
          <>
            {[["Low", "#00ff9d"], ["Medium", "#facc15"], ["High", "#ff8a3d"], ["Critical", "#ff4d6d"]].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>
            ))}
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-sev-critical" />Flagged flow</span>
          </>
        ) : (
          <>
            {[["Case A", MEMBERSHIP_COLOR.A], ["Case B", MEMBERSHIP_COLOR.B], ["Shared", MEMBERSHIP_COLOR.both]].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>
            ))}
          </>
        )}
      </div>

      {truncated && (
        <div className={clsx("absolute right-3 top-3 rounded-lg border border-sev-medium/30 bg-sev-medium/10 px-2.5 py-1 text-[11px] text-sev-medium")}>
          Showing top {MAX_NODES} of {nodes.length} accounts
        </div>
      )}
    </div>
  );
};
