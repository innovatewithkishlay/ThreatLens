import { motion } from "framer-motion";
import { riskColor } from "../../lib/format";

export const RiskGauge = ({ score, size = 120, label = "Risk" }: { score: number; size?: number; label?: string }) => {
  const stroke = Math.max(6, size / 14);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270° gauge
  const color = riskColor(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[135deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} strokeDasharray={`${c * arc} ${c}`} strokeLinecap="round" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${(c * arc * Math.max(score, 1)) / 100} ${c}` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 ${size / 16}px ${color}99)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold tabular-nums leading-none" style={{ color, fontSize: size / 3.6 }}>
          {score}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      </div>
    </div>
  );
};

export const RiskBar = ({ score, className }: { score: number; className?: string }) => (
  <div className={className}>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(score, 2)}%`, background: riskColor(score) }} />
    </div>
  </div>
);
