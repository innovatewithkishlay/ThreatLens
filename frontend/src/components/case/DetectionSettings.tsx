import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { FiRefreshCw, FiRotateCcw } from "react-icons/fi";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import type { CaseDetail, Thresholds } from "../../lib/types";

type Field = { path: string; label: string; help: string; step?: number; suffix?: string };

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Value",
    fields: [
      { path: "HIGH_VALUE", label: "High-value threshold", help: "Single transfers at or above this amount" },
      { path: "REPORTING_THRESHOLD", label: "Reporting threshold", help: "Used for structuring and smurfing" },
      { path: "STRUCTURING_MIN_COUNT", label: "Structuring: min. transfers", help: "Near-threshold transfers from one account" },
    ],
  },
  {
    title: "Velocity",
    fields: [
      { path: "RAPID_SUCCESSIVE.count", label: "Burst: transfers", help: "Outgoing transfers within the window" },
      { path: "RAPID_SUCCESSIVE.minutes", label: "Burst: window", help: "Minutes", suffix: "min" },
      { path: "PASS_THROUGH.windowHours", label: "Pass-through window", help: "Hours between receiving and forwarding", step: 0.5, suffix: "h" },
      { path: "PASS_THROUGH.minAmount", label: "Pass-through min. amount", help: "Ignore smaller transfers" },
    ],
  },
  {
    title: "Network",
    fields: [
      { path: "SMURFING.minCounterparties", label: "Fan-in/out: counterparties", help: "Distinct accounts within the window" },
      { path: "SMURFING.windowHours", label: "Fan-in/out: window", help: "Hours", suffix: "h" },
      { path: "CIRCULAR.minAmount", label: "Circular flow min. amount", help: "Smallest hop amount considered" },
      { path: "FREQUENT_PAIR_COUNT", label: "Repeated counterparty", help: "Transfers between the same pair (more than)" },
    ],
  },
  {
    title: "Accounts",
    fields: [
      { path: "NEW_ACCOUNT_DAYS", label: "New account age", help: "Days since opening", suffix: "days" },
      { path: "NEW_ACCOUNT_HIGH_VALUE", label: "New account large transfer", help: "Amount considered large for a new account" },
      { path: "DORMANT.days", label: "Dormancy period", help: "Days without activity before reactivation counts", suffix: "days" },
      { path: "DORMANT.minAmount", label: "Reactivation amount", help: "Volume moved after waking up" },
      { path: "OUTLIER.multiple", label: "Out-of-pattern multiple", help: "× the account's median transfer", suffix: "×" },
      { path: "OUTLIER.minAmount", label: "Out-of-pattern min. amount", help: "Ignore smaller transfers" },
    ],
  },
];

const get = (o: unknown, p: string) => p.split(".").reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o);
const set = (o: Record<string, unknown>, p: string, v: unknown) => {
  const keys = p.split(".");
  const last = keys.pop()!;
  const target = keys.reduce<Record<string, unknown>>((x, k) => (x[k] = { ...((x[k] as object) || {}) }) as Record<string, unknown>, o);
  target[last] = v;
};

export const DetectionSettings = ({ open, onClose, data, onUpdated }: { open: boolean; onClose: () => void; data: CaseDetail; onUpdated: (c: CaseDetail) => void }) => {
  const [values, setValues] = useState<Thresholds>(data.settings);
  const [countries, setCountries] = useState(data.settings.HIGH_RISK_COUNTRIES.join(", "));
  const [hours, setHours] = useState<[number, number]>(data.settings.UNUSUAL_HOURS);
  const [busy, setBusy] = useState<"run" | "reset" | null>(null);

  useEffect(() => {
    if (open) {
      setValues(data.settings);
      setCountries(data.settings.HIGH_RISK_COUNTRIES.join(", "));
      setHours(data.settings.UNUSUAL_HOURS);
    }
  }, [open, data.settings]);

  const run = async (reset = false) => {
    setBusy(reset ? "reset" : "run");
    try {
      const payload = reset
        ? null
        : { ...values, UNUSUAL_HOURS: hours, HIGH_RISK_COUNTRIES: countries.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean) };
      const before = data.analysis.summary.totalFindings;
      const updated = await api.reanalyze(data._id, payload);
      onUpdated(updated);
      const diff = updated.analysis.summary.totalFindings - before;
      toast.success(`Re-analysed: ${updated.analysis.summary.totalFindings} findings (${diff >= 0 ? "+" : ""}${diff}), risk ${updated.riskScore}`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Detection settings" className="max-w-2xl">
      <div className="space-y-6 p-5">
        <p className="text-sm text-slate-400">
          Tune detection to your institution's risk appetite, then re-run the analysis. Your transaction review decisions are kept, and your current watchlist is
          re-screened.
        </p>
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="label mb-3">{g.title}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.fields.map((f) => (
                <label key={f.path} className="block">
                  <span className="text-sm text-slate-200">{f.label}</span>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min={0}
                      step={f.step || 1}
                      className="input pr-12 font-mono"
                      value={String(get(values, f.path) ?? "")}
                      onChange={(e) => {
                        const next = structuredClone(values) as unknown as Record<string, unknown>;
                        set(next, f.path, e.target.value === "" ? "" : Number(e.target.value));
                        setValues(next as unknown as Thresholds);
                      }}
                    />
                    {f.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{f.suffix}</span>}
                  </div>
                  <span className="mt-1 block text-xs text-slate-500">{f.help}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <div>
          <p className="label mb-3">Time & geography</p>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <label className="block">
              <span className="text-sm text-slate-200">Off-hours (from–to)</span>
              <div className="mt-1 flex items-center gap-2">
                {[0, 1].map((i) => (
                  <input
                    key={i}
                    type="number"
                    min={0}
                    max={23}
                    className="input font-mono"
                    value={hours[i]}
                    onChange={(e) => setHours((h) => (i ? [h[0], Number(e.target.value)] : [Number(e.target.value), h[1]]))}
                  />
                ))}
              </div>
            </label>
            <label className="block">
              <span className="text-sm text-slate-200">High-risk jurisdictions</span>
              <textarea rows={2} className="input mt-1 font-mono text-xs" value={countries} onChange={(e) => setCountries(e.target.value)} />
              <span className="mt-1 block text-xs text-slate-500">ISO 3166 alpha-2 codes, comma separated</span>
            </label>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-between">
          <Button variant="ghost" icon={<FiRotateCcw />} loading={busy === "reset"} disabled={!!busy} onClick={() => run(true)}>
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={!!busy}>Cancel</Button>
            <Button icon={<FiRefreshCw />} loading={busy === "run"} disabled={!!busy} onClick={() => run(false)}>Re-run analysis</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
