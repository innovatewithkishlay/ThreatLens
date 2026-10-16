import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { FiArrowLeft, FiArrowRight, FiCrosshair, FiInfo } from "react-icons/fi";
import { api, type ApiError } from "../../lib/api";
import type { AccountRisk, TraceResult } from "../../lib/types";
import { formatDateTime, formatMoney, riskColor } from "../../lib/format";
import { FlowDiagram } from "../viz/FlowDiagram";
import { Card, CardHeader, EmptyState } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { ErrorPanel } from "../ui/ErrorPanel";
import { StatTile } from "../ui/StatTile";

export const FundTrace = ({
  caseId,
  accounts,
  initialAccount,
  currency,
  onAccount,
}: {
  caseId: string;
  accounts: AccountRisk[];
  initialAccount?: string | null;
  currency?: string;
  onAccount: (id: string) => void;
}) => {
  const [account, setAccount] = useState(initialAccount || accounts[0]?.account || "");
  const [draft, setDraft] = useState(account);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [hops, setHops] = useState(6);
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (initialAccount) {
      setAccount(initialAccount);
      setDraft(initialAccount);
    }
  }, [initialAccount]);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .trace(caseId, account, direction, hops)
      .then((t) => !cancelled && setTrace(t))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [caseId, account, direction, hops]);

  const known = useMemo(() => new Set(accounts.map((a) => a.account)), [accounts]);
  const forward = direction === "forward";
  const coverage = trace && trace.totalTraced ? trace.endpoints.reduce((s, e) => s + e.retained, 0) / trace.totalTraced : 0;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="trace-account" className="label mb-2 block">Account to trace</label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) setAccount(draft.trim());
              }}
              className="flex gap-2"
            >
              <input id="trace-account" list="trace-accounts" className="input font-mono" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => known.has(draft.trim()) && setAccount(draft.trim())} />
              <datalist id="trace-accounts">
                {accounts.slice(0, 300).map((a) => (
                  <option key={a.account} value={a.account}>{`${a.holder || ""} · risk ${a.score}`}</option>
                ))}
              </datalist>
              <button type="submit" className="rounded-xl bg-accent px-4 text-sm font-semibold text-ink-950 hover:bg-accent-soft" aria-label="Trace">
                <FiCrosshair />
              </button>
            </form>
          </div>
          <div>
            <span className="label mb-2 block">Direction</span>
            <div className="inline-flex rounded-xl border border-white/[0.08] bg-ink-900 p-1">
              {(["forward", "backward"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={clsx("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition", direction === d ? "bg-accent text-ink-950" : "text-slate-400 hover:text-white")}
                >
                  {d === "forward" ? <><FiArrowRight /> Where did it go?</> : <><FiArrowLeft /> Where did it come from?</>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="hops" className="label mb-2 block">Max hops: {hops}</label>
            <input id="hops" type="range" min={1} max={10} value={hops} onChange={(e) => setHops(Number(e.target.value))} className="w-36 accent-[#00ff9d]" />
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <FiInfo className="mt-0.5 shrink-0" />
          Transfers are replayed in time order. Funds can only move on after they arrive, and the traced share of each onward transfer is capped at what the account received
          from the trail (worst-case, "tainted funds leave first").
        </p>
      </Card>

      {error && <ErrorPanel error={error} title="Trace failed" />}

      {loading && !trace && (
        <div className="flex justify-center py-16 text-accent"><Spinner className="h-8 w-8" /></div>
      )}

      {trace && (
        <div className={clsx("space-y-6 transition-opacity", loading && "opacity-50")}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label={forward ? "Funds sent" : "Funds received"} value={formatMoney(trace.totalTraced, currency, true)} hint={`by ${trace.origin}`} />
            <StatTile label="Accounts reached" value={Math.max(0, trace.nodes.length - 1)} hint={`${trace.depth} hop${trace.depth === 1 ? "" : "s"} deep`} />
            <StatTile label={forward ? "Final destinations" : "Original sources"} value={trace.endpoints.length} tone="accent" />
            <StatTile label="Traced to endpoints" value={`${Math.round(coverage * 100)}%`} hint={forward ? "of funds located" : "of funds explained"} />
          </div>

          <Card>
            <CardHeader
              title={forward ? `Where money from ${trace.origin} went` : `Where money reaching ${trace.origin} came from`}
              subtitle="Ribbon width = amount traced · yellow marker = funds that stop at that account · click an account for details"
              icon={<FiCrosshair />}
            />
            <div className="px-5 pb-5">
              {trace.edges.length ? (
                <FlowDiagram trace={trace} currency={currency} onSelect={onAccount} />
              ) : (
                <EmptyState title={forward ? "No outgoing transfers" : "No incoming transfers"} description={`${trace.origin} has no ${forward ? "outgoing" : "incoming"} transfers to follow.`} />
              )}
            </div>
          </Card>

          {trace.endpoints.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title={forward ? "Final destinations" : "Original sources"} subtitle={forward ? "Accounts where traced funds remain" : "Accounts where the traced funds originate"} icon={<FiCrosshair />} />
                <div className="space-y-1 px-3 pb-4">
                  {trace.endpoints.slice(0, 15).map((n) => {
                    const pct = trace.totalTraced ? n.retained / trace.totalTraced : 0;
                    return (
                      <button key={n.account} onClick={() => onAccount(n.account)} className="w-full rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.03]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="font-mono text-sm text-white">{n.account}</span>
                            <span className="ml-2 text-xs text-slate-500">hop {n.hop}{n.holder ? ` · ${n.holder}` : ""}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm text-slate-200">{formatMoney(n.retained, currency, true)}</span>
                            <span className="w-10 text-right text-xs text-slate-500">{Math.round(pct * 100)}%</span>
                          </div>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct * 100)}%`, background: riskColor(n.score) }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
              <Card>
                <CardHeader title="Trail" subtitle="Each hop in the trace" icon={<FiArrowRight />} />
                <div className="max-h-[420px] overflow-auto pb-2">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-ink-850">
                      <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="px-5 py-2 font-semibold">Hop</th>
                        <th className="px-3 py-2 font-semibold">{forward ? "From → To" : "To ← From"}</th>
                        <th className="px-5 py-2 text-right font-semibold">Traced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trace.edges.slice(0, 200).map((e, i) => (
                        <tr key={i} className="border-b border-white/[0.04]">
                          <td className="px-5 py-2 text-slate-500">{e.hop}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            <button onClick={() => onAccount(e.from)} className="text-slate-200 hover:text-accent">{e.from}</button>
                            <span className="mx-1.5 text-slate-600">{forward ? "→" : "←"}</span>
                            <button onClick={() => onAccount(e.to)} className="text-slate-200 hover:text-accent">{e.to}</button>
                            {e.count > 1 && <span className="ml-2 text-slate-600">×{e.count}</span>}
                          </td>
                          <td className="px-5 py-2 text-right font-mono text-xs text-slate-200">{formatMoney(e.amount, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
          {trace.nodes.find((n) => n.firstSeen) && (
            <p className="text-xs text-slate-500">
              Trail window: {formatDateTime(trace.nodes.filter((n) => n.firstSeen).map((n) => n.firstSeen!).sort()[0])} –{" "}
              {formatDateTime(trace.nodes.filter((n) => n.firstSeen).map((n) => n.firstSeen!).sort().slice(-1)[0])}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
