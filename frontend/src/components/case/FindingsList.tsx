import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { FiChevronDown, FiList, FiShare2 } from "react-icons/fi";
import type { Finding, Severity } from "../../lib/types";
import { formatMoney, SEVERITY, SEVERITY_ORDER } from "../../lib/format";
import { SeverityBadge } from "../ui/Badge";
import { EmptyState } from "../ui/Card";

export const FindingCard = ({
  finding,
  currency,
  onAccount,
  onTransactions,
  onNetwork,
  defaultOpen = false,
}: {
  finding: Finding;
  currency?: string;
  onAccount?: (id: string) => void;
  onTransactions?: (f: Finding) => void;
  onNetwork?: (f: Finding) => void;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const sev = SEVERITY[finding.severity];
  return (
    <div className={clsx("overflow-hidden rounded-xl border bg-ink-900/60 transition", open ? "border-white/10" : "border-white/[0.05] hover:border-white/10")}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={open}>
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: sev.color, boxShadow: `0 0 10px ${sev.color}` }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{finding.label}</span>
            <SeverityBadge level={finding.severity} />
          </div>
          <p className="mt-1 text-sm font-medium text-slate-100">{finding.title}</p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <div className="font-mono text-sm text-white">{formatMoney(finding.amount, currency, true)}</div>
          <div className="text-[11px] text-slate-500">{finding.transactions.length} transfers</div>
        </div>
        <FiChevronDown className={clsx("mt-1 shrink-0 text-slate-500 transition", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 sm:pl-9">
              <p className="text-sm text-slate-400">{finding.description}</p>
              {Array.isArray(finding.meta?.path) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-xs">
                  {(finding.meta.path as string[]).map((a, i, arr) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className="rounded-md bg-sev-critical/10 px-2 py-1 text-sev-critical ring-1 ring-sev-critical/20">{a}</span>
                      {i < arr.length - 1 && <span className="text-slate-600">→</span>}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3">
                <p className="label mb-1.5">Accounts involved</p>
                <div className="flex flex-wrap gap-1.5">
                  {finding.accounts.slice(0, 24).map((a) => (
                    <button
                      key={a}
                      onClick={() => onAccount?.(a)}
                      className={clsx(
                        "rounded-md px-2 py-1 font-mono text-xs ring-1 transition",
                        finding.subjects.includes(a) ? "bg-white/[0.08] text-white ring-white/15 hover:ring-accent/50" : "bg-white/[0.03] text-slate-400 ring-white/[0.06] hover:text-white"
                      )}
                      title={finding.subjects.includes(a) ? "Primary subject" : "Counterparty"}
                    >
                      {a}
                    </button>
                  ))}
                  {finding.accounts.length > 24 && <span className="px-2 py-1 text-xs text-slate-500">+{finding.accounts.length - 24} more</span>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {onTransactions && (
                  <button onClick={() => onTransactions(finding)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.1]">
                    <FiList /> View {finding.transactions.length} transfers
                  </button>
                )}
                {onNetwork && (
                  <button onClick={() => onNetwork(finding)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/[0.1]">
                    <FiShare2 /> Show in network
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FindingsList = ({
  findings,
  currency,
  onAccount,
  onTransactions,
  onNetwork,
}: {
  findings: Finding[];
  currency?: string;
  onAccount?: (id: string) => void;
  onTransactions?: (f: Finding) => void;
  onNetwork?: (f: Finding) => void;
}) => {
  const [sev, setSev] = useState<Severity | "all">("all");
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => ["all", ...new Set(findings.map((f) => f.category))], [findings]);
  const visible = findings.filter((f) => (sev === "all" || f.severity === sev) && (category === "all" || f.category === category));

  if (!findings.length) {
    return <EmptyState icon="✓" title="No suspicious patterns found" description="None of the 17 detectors fired for this dataset. Review the network and timeline to confirm." />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", ...SEVERITY_ORDER] as const).map((s) => {
          const count = s === "all" ? findings.length : findings.filter((f) => f.severity === s).length;
          if (s !== "all" && !count) return null;
          return (
            <button
              key={s}
              onClick={() => setSev(s)}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                sev === s ? "bg-white/10 text-white ring-1 ring-white/20" : "text-slate-400 hover:bg-white/[0.05]"
              )}
            >
              {s !== "all" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY[s].color }} />}
              {s === "all" ? "All" : SEVERITY[s].label}
              <span className="text-slate-500">{count}</span>
            </button>
          );
        })}
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input ml-auto w-auto py-1.5 text-xs" aria-label="Filter by category">
          {categories.map((c) => (
            <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2.5">
        {visible.map((f, i) => (
          <FindingCard key={f.id} finding={f} currency={currency} onAccount={onAccount} onTransactions={onTransactions} onNetwork={onNetwork} defaultOpen={i === 0 && sev === "all" && category === "all"} />
        ))}
      </div>
    </div>
  );
};
