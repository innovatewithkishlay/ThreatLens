import clsx from "clsx";

export const Spinner = ({ className }: { className?: string }) => (
  <svg className={clsx("animate-spin", className || "h-5 w-5")} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const PageLoader = ({ label = "Loading" }: { label?: string }) => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5">
    <div className="relative h-16 w-16">
      <span className="absolute inset-0 rounded-full border border-accent/40 animate-pulse-ring" />
      <span className="absolute inset-0 rounded-full border border-accent/30 animate-pulse-ring [animation-delay:0.6s]" />
      <div className="absolute inset-2 rounded-full bg-accent/10 border border-accent/40 flex items-center justify-center">
        <Spinner className="h-6 w-6 text-accent" />
      </div>
    </div>
    <p className="font-mono text-sm text-slate-400">{label}…</p>
  </div>
);
