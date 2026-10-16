import { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import type { AccountRisk } from "../../lib/types";
import { formatMoney, riskColor } from "../../lib/format";
import { flag } from "../../lib/countries";
import { SeverityBadge } from "../ui/Badge";
import { RiskBar } from "../ui/RiskGauge";

export const AccountsTable = ({ accounts, onSelect, currency }: { accounts: AccountRisk[]; onSelect: (id: string) => void; currency?: string }) => {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => !q || a.account.toLowerCase().includes(q) || a.holder?.toLowerCase().includes(q));
  }, [accounts, query]);

  return (
    <div>
      <div className="px-5 pb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search accounts or holders" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-y border-white/[0.06] bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5 font-semibold">Account</th>
              <th className="px-3 py-2.5 font-semibold">Risk</th>
              <th className="px-3 py-2.5 text-right font-semibold">Inflow</th>
              <th className="px-3 py-2.5 text-right font-semibold">Outflow</th>
              <th className="px-5 py-2.5 font-semibold">Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((a) => (
              <tr key={a.account} onClick={() => onSelect(a.account)} className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]">
                <td className="px-5 py-3">
                  <div className="font-mono text-sm text-white">{a.account}</div>
                  <div className="text-xs text-slate-500">
                    {a.holder || "Unknown holder"}
                    {a.country && ` · ${flag(a.country)} ${a.country}`}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 font-display font-bold tabular-nums" style={{ color: riskColor(a.score) }}>{a.score}</span>
                    <RiskBar score={a.score} className="w-20" />
                    <SeverityBadge level={a.level} />
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono text-xs text-slate-300">{formatMoney(a.inflow, currency, true)}<div className="text-slate-600">{a.received} in</div></td>
                <td className="px-3 py-3 text-right font-mono text-xs text-slate-300">{formatMoney(a.outflow, currency, true)}<div className="text-slate-600">{a.sent} out</div></td>
                <td className="px-5 py-3">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {a.reasons.length ? a.reasons.slice(0, 3).map((r) => (
                      <span key={r} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-slate-300">{r}</span>
                    )) : <span className="text-xs text-slate-600">No findings</span>}
                    {a.reasons.length > 3 && <span className="text-[11px] text-slate-500">+{a.reasons.length - 3}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="p-4 text-center">
          <button onClick={() => setLimit((l) => l + 50)} className="text-sm text-accent hover:underline">Show more ({rows.length - limit} remaining)</button>
        </div>
      )}
    </div>
  );
};
