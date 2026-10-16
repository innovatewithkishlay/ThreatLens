import { motion } from "framer-motion";
import clsx from "clsx";

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export const Tabs = ({ tabs, active, onChange, layoutId = "tabs" }: { tabs: TabItem[]; active: string; onChange: (k: string) => void; layoutId?: string }) => (
  <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
    <div className="inline-flex min-w-full gap-1 rounded-2xl border border-white/[0.06] bg-ink-900/80 p-1 sm:min-w-0">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={clsx(
              "relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              isActive ? "text-ink-950" : "text-slate-400 hover:text-white"
            )}
          >
            {isActive && (
              <motion.span layoutId={layoutId} className="absolute inset-0 rounded-xl bg-accent" transition={{ type: "spring", damping: 30, stiffness: 400 }} />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={clsx("rounded-md px-1.5 text-[11px] tabular-nums", isActive ? "bg-ink-950/15" : "bg-white/[0.06] text-slate-400")}>
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);
