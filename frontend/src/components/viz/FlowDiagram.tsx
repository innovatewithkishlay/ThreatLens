import { useEffect, useMemo, useRef, useState } from "react";
import type { TraceResult } from "../../lib/types";
import { formatMoney, riskColor } from "../../lib/format";

const NODE_W = 14;
const GAP = 14;
const MAX_PER_COLUMN = 10;

interface LNode {
  id: string;
  col: number;
  value: number;
  x: number;
  y: number;
  h: number;
  score: number;
  retained: number;
  isOrigin: boolean;
}
interface LLink {
  from: LNode;
  to: LNode;
  amount: number;
  w: number;
  sy: number;
  ty: number;
}

/**
 * Layered flow diagram for a fund trace. Money always flows left to right:
 * forward traces start at the origin on the left, backward traces end at the
 * origin on the right.
 */
export const FlowDiagram = ({ trace, currency, onSelect }: { trace: TraceResult; currency?: string; onSelect?: (id: string) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(480, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const forward = trace.direction === "forward";
    const depth = Math.max(1, trace.depth);
    const hopOf = new Map(trace.nodes.map((n) => [n.account, n.hop]));

    // Keep the largest nodes in each column so the diagram stays legible.
    const byCol = new Map<number, typeof trace.nodes>();
    trace.nodes.forEach((n) => {
      const list = byCol.get(n.hop) || [];
      list.push(n);
      byCol.set(n.hop, list);
    });
    const kept = new Set<string>();
    let hidden = 0;
    byCol.forEach((list) => {
      const sorted = [...list].sort((a, b) => Math.max(b.received, b.passedOn) - Math.max(a.received, a.passedOn));
      sorted.slice(0, MAX_PER_COLUMN).forEach((n) => kept.add(n.account));
      hidden += Math.max(0, sorted.length - MAX_PER_COLUMN);
    });

    const edges = trace.edges.filter((e) => kept.has(e.from) && kept.has(e.to) && (hopOf.get(e.to) ?? 0) > (hopOf.get(e.from) ?? 0));

    const labelSpace = 150;
    const colW = (width - labelSpace - NODE_W) / depth;
    const height = Math.max(320, Math.min(720, Math.max(...[...byCol.values()].map((l) => Math.min(l.length, MAX_PER_COLUMN))) * 58));

    const nodes = new Map<string, LNode>();
    trace.nodes
      .filter((n) => kept.has(n.account))
      .forEach((n) => {
        const value = n.account === trace.origin ? trace.totalTraced : Math.max(n.received, n.passedOn);
        const col = forward ? n.hop : depth - n.hop;
        nodes.set(n.account, { id: n.account, col, value, x: col * colW, y: 0, h: 0, score: n.score, retained: n.retained, isOrigin: n.account === trace.origin });
      });

    const cols = new Map<number, LNode[]>();
    nodes.forEach((n) => cols.set(n.col, [...(cols.get(n.col) || []), n]));
    // Each node gets at least a label-sized slot so small flows never overlap.
    const MIN_SLOT = 30;
    let k = Infinity;
    cols.forEach((list) => {
      const total = list.reduce((s, n) => s + n.value, 0);
      k = Math.min(k, (height - GAP * (list.length - 1)) / Math.max(total, 1));
    });
    let svgHeight = height;
    cols.forEach((list) => {
      list.forEach((n) => (n.h = Math.max(3, n.value * k)));
      const total = list.reduce((s, n) => s + Math.max(n.h, MIN_SLOT), 0) + GAP * (list.length - 1);
      svgHeight = Math.max(svgHeight, total);
    });
    cols.forEach((list) => {
      list.sort((a, b) => b.value - a.value);
      const total = list.reduce((s, n) => s + Math.max(n.h, MIN_SLOT), 0) + GAP * (list.length - 1);
      let y = (svgHeight - total) / 2;
      list.forEach((n) => {
        const slot = Math.max(n.h, MIN_SLOT);
        n.y = y + (slot - n.h) / 2;
        y += slot + GAP;
      });
    });

    const links: LLink[] = edges.map((e) => {
      // Visual direction is always left -> right.
      const a = nodes.get(e.from)!;
      const b = nodes.get(e.to)!;
      const [from, to] = a.col <= b.col ? [a, b] : [b, a];
      return { from, to, amount: e.amount, w: Math.max(1, e.amount * k), sy: 0, ty: 0 };
    });
    const outOff = new Map<string, number>();
    const inOff = new Map<string, number>();
    [...links].sort((p, q) => p.to.y - q.to.y).forEach((l) => {
      l.sy = l.from.y + (outOff.get(l.from.id) || 0);
      outOff.set(l.from.id, (outOff.get(l.from.id) || 0) + l.w);
    });
    [...links].sort((p, q) => p.from.y - q.from.y).forEach((l) => {
      l.ty = l.to.y + (inOff.get(l.to.id) || 0);
      inOff.set(l.to.id, (inOff.get(l.to.id) || 0) + l.w);
    });

    return { nodes: [...nodes.values()], links, height: svgHeight, hidden, depth };
  }, [trace, width]);

  const related = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    layout.links.forEach((l) => {
      if (l.from.id === hover) s.add(l.to.id);
      if (l.to.id === hover) s.add(l.from.id);
    });
    return s;
  }, [hover, layout]);

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      <svg width={width} height={layout.height + 20} className="block">
        <defs>
          <linearGradient id="flow-grad" x1="0" x2="1">
            <stop offset="0%" stopColor="#00ff9d" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <g transform="translate(0,10)">
          {layout.links.map((l, i) => {
            const x0 = l.from.x + NODE_W;
            const x1 = l.to.x;
            const xm = (x0 + x1) / 2;
            const d = `M${x0},${l.sy} C${xm},${l.sy} ${xm},${l.ty} ${x1},${l.ty} L${x1},${l.ty + l.w} C${xm},${l.ty + l.w} ${xm},${l.sy + l.w} ${x0},${l.sy + l.w} Z`;
            const active = !hover || hover === l.from.id || hover === l.to.id;
            return (
              <path key={i} d={d} fill="url(#flow-grad)" opacity={active ? 0.85 : 0.12} className="transition-opacity">
                <title>{`${l.from.id} → ${l.to.id}: ${formatMoney(l.amount, currency)}`}</title>
              </path>
            );
          })}
          {layout.nodes.map((n) => {
            const color = n.isOrigin ? "#ffffff" : riskColor(n.score);
            const labelRight = true;
            const dim = related && !related.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-pointer"
                opacity={dim ? 0.3 : 1}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(n.id)}
              >
                <rect width={NODE_W} height={n.h} rx={3} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
                {n.retained > 0 && !n.isOrigin && (
                  <rect x={-4} width={3} height={Math.max(2, (n.retained / n.value) * n.h)} y={n.h - Math.max(2, (n.retained / n.value) * n.h)} rx={1} fill="#facc15" />
                )}
                <text
                  x={labelRight ? NODE_W + 8 : -8}
                  y={n.h / 2}
                  dy="-0.15em"
                  textAnchor={labelRight ? "start" : "end"}
                  className="fill-white font-mono"
                  style={{ paintOrder: "stroke", stroke: "#05070a", strokeWidth: 3 }}
                  fontSize={11}
                  fontWeight={n.isOrigin ? 700 : 500}
                >
                  {n.id}
                </text>
                <text x={labelRight ? NODE_W + 8 : -8} y={n.h / 2} dy="1.05em" textAnchor={labelRight ? "start" : "end"} className="fill-slate-400 font-mono" fontSize={10} style={{ paintOrder: "stroke", stroke: "#05070a", strokeWidth: 3 }}>
                  {formatMoney(n.value, currency, true)}
                  {n.retained > 0 && !n.isOrigin ? ` · ${formatMoney(n.retained, currency, true)} ${trace.direction === "forward" ? "held" : "origin"}` : ""}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {layout.hidden > 0 && <p className="mt-2 text-xs text-slate-500">{layout.hidden} smaller accounts hidden for readability - see the table below.</p>}
    </div>
  );
};
