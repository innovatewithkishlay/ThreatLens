import { motion } from "framer-motion";

// Decorative animated network used on the landing page.
const NODES = [
  { id: 0, x: 80, y: 90, r: 7 },
  { id: 1, x: 210, y: 50, r: 9 },
  { id: 2, x: 330, y: 110, r: 7 },
  { id: 3, x: 150, y: 210, r: 12, hot: true },
  { id: 4, x: 290, y: 240, r: 10, hot: true },
  { id: 5, x: 420, y: 200, r: 8 },
  { id: 6, x: 60, y: 300, r: 6 },
  { id: 7, x: 220, y: 330, r: 11, hot: true },
  { id: 8, x: 380, y: 330, r: 7 },
  { id: 9, x: 460, y: 80, r: 6 },
];
const EDGES: [number, number, boolean?][] = [
  [0, 1], [1, 2], [0, 3], [1, 3], [2, 4], [3, 4, true], [4, 7, true], [7, 3, true], [4, 5], [5, 9], [2, 9], [6, 3], [6, 7], [7, 8], [8, 5],
];

export const HeroGraph = () => (
  <div className="relative mx-auto aspect-[520/400] w-full max-w-[560px]">
    <div className="absolute inset-6 rounded-full bg-accent/10 blur-3xl" />
    <svg viewBox="0 0 520 400" className="relative h-full w-full">
      <defs>
        <radialGradient id="hg-node" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5cffc0" />
          <stop offset="100%" stopColor="#00c47a" />
        </radialGradient>
        <radialGradient id="hg-hot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff8fa3" />
          <stop offset="100%" stopColor="#ff4d6d" />
        </radialGradient>
        <filter id="hg-glow">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {EDGES.map(([a, b, hot], i) => {
        const A = NODES[a];
        const B = NODES[b];
        const d = `M${A.x},${A.y} L${B.x},${B.y}`;
        return (
          <g key={i}>
            <motion.path
              d={d}
              stroke={hot ? "#ff4d6d" : "#00ff9d"}
              strokeOpacity={hot ? 0.7 : 0.22}
              strokeWidth={hot ? 2 : 1.2}
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, delay: 0.2 + i * 0.06 }}
            />
            <circle r={hot ? 3 : 2.2} fill={hot ? "#ff8fa3" : "#5cffc0"} filter="url(#hg-glow)">
              <animateMotion dur={`${hot ? 1.8 : 3 + (i % 4)}s`} repeatCount="indefinite" path={d} begin={`${(i * 0.37) % 2}s`} />
            </circle>
          </g>
        );
      })}

      {NODES.map((n, i) => (
        <motion.g key={n.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 + i * 0.07, type: "spring" }} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
          {n.hot && (
            <circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke="#ff4d6d" strokeWidth="1.5">
              <animate attributeName="r" from={n.r} to={n.r * 3} dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.8" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
          )}
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.hot ? "url(#hg-hot)" : "url(#hg-node)"} filter="url(#hg-glow)" />
        </motion.g>
      ))}
    </svg>

    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1.4 }}
      className="glass absolute right-0 top-[52%] rounded-xl px-3.5 py-2.5 sm:-right-4"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-sev-critical">
        <span className="h-2 w-2 animate-pulse rounded-full bg-sev-critical" /> Circular flow detected
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-slate-400">ACC1010 → ACC1011 → ACC1013 → ACC1010</div>
    </motion.div>
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1.7 }}
      className="glass absolute left-0 top-[6%] rounded-xl px-3.5 py-2.5 sm:-left-4"
    >
      <div className="label">Case risk</div>
      <div className="font-display text-2xl font-bold text-sev-critical">82<span className="text-sm text-slate-500">/100</span></div>
    </motion.div>
  </div>
);
