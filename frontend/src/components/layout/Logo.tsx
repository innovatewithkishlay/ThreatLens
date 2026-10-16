import { Link } from "react-router-dom";

export const Logo = ({ compact = false }: { compact?: boolean }) => (
  <Link to="/" className="group flex items-center gap-2.5" aria-label="ThreatLens home">
    <img src="/assets/logoB.png" alt="" className="h-9 w-auto drop-shadow-[0_0_12px_rgba(0,255,157,0.35)] transition-transform group-hover:scale-105" draggable={false} />
    {!compact && (
      <span className="font-display text-xl font-bold tracking-tight text-white">
        Threat<span className="text-accent">Lens</span>
      </span>
    )}
  </Link>
);
