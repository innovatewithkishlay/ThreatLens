import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiCornerDownLeft, FiFolder, FiSearch, FiUser } from "react-icons/fi";
import { api } from "../../lib/api";
import type { SearchResult } from "../../lib/types";
import { formatMoney, riskColor } from "../../lib/format";
import { Spinner } from "../ui/Spinner";

export const SearchPalette = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      setQ("");
      setResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResult(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      api
        .search(query, ctrl.signal)
        .then(setResult)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Search"
            initial={{ y: -12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -12, scale: 0.98 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
              {loading ? <Spinner className="h-5 w-5 text-accent" /> : <FiSearch className="text-lg text-slate-500" />}
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search accounts, names, emails, phones, IPs or cases…"
                className="h-14 flex-1 bg-transparent text-base text-white placeholder:text-slate-600 focus:outline-none"
              />
              <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">ESC</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!result && (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  Have you seen this entity before? Search across <span className="text-slate-300">every case</span> in your workspace.
                </p>
              )}
              {result && !result.entities.length && !result.cases.length && (
                <p className="px-3 py-8 text-center text-sm text-slate-500">No matches for “{result.query}”.</p>
              )}
              {result && result.cases.length > 0 && (
                <div className="mb-2">
                  <p className="label px-3 py-2">Cases</p>
                  {result.cases.map((c) => (
                    <button key={c._id} onClick={() => go(`/cases/${c._id}`)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.05]">
                      <FiFolder className="text-slate-500" />
                      <span className="flex-1 truncate text-sm text-white">{c.name}</span>
                      <span className="font-mono text-xs text-slate-500">{c.caseId}</span>
                      <FiCornerDownLeft className="text-slate-600 opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}
              {result && result.entities.length > 0 && (
                <div>
                  <p className="label px-3 py-2">Accounts & identities</p>
                  {result.entities.map((e) => (
                    <div key={e.account} className="rounded-xl px-3 py-2.5 hover:bg-white/[0.03]">
                      <div className="flex items-center gap-3">
                        <FiUser className="text-slate-500" />
                        <span className="font-mono text-sm text-white">{e.account}</span>
                        {e.holder && <span className="truncate text-sm text-slate-400">{e.holder}</span>}
                        <span className="ml-auto shrink-0 rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-300">
                          {e.appearances.length} case{e.appearances.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                        {e.appearances.map((a) => (
                          <button
                            key={a.caseId}
                            onClick={() => go(`/cases/${a.caseId}?account=${encodeURIComponent(e.account)}`)}
                            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-ink-900 px-2.5 py-1 text-xs text-slate-300 hover:border-accent/40 hover:text-white"
                            title={[a.email, a.mobile, a.ipAddress].filter(Boolean).join(" · ")}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: riskColor(a.score) }} />
                            {a.caseName}
                            <span className="font-mono text-slate-500">risk {a.score}</span>
                            {a.outflow ? <span className="font-mono text-slate-600">↑{formatMoney(a.outflow, undefined, true)}</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
