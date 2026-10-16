import { useMemo } from "react";
import { FiCrosshair, FiEye, FiMail, FiMonitor, FiPhone } from "react-icons/fi";
import { Button } from "../ui/Button";
import type { Account, AccountRisk, Finding, Transaction } from "../../lib/types";
import { formatDate, formatDateTime, formatMoney } from "../../lib/format";
import { countryName, flag } from "../../lib/countries";
import { Modal } from "../ui/Modal";
import { RiskGauge } from "../ui/RiskGauge";
import { SeverityBadge } from "../ui/Badge";

export const AccountDrawer = ({
  accountId,
  onClose,
  risk,
  account,
  findings,
  transactions,
  currency,
  onAccount,
  onTrace,
  onWatchlist,
}: {
  accountId: string | null;
  onClose: () => void;
  risk?: AccountRisk;
  account?: Account;
  findings: Finding[];
  transactions: Transaction[];
  currency?: string;
  onAccount: (id: string) => void;
  onTrace?: (id: string) => void;
  onWatchlist?: (id: string) => void;
}) => {
  const related = useMemo(() => (accountId ? findings.filter((f) => f.accounts.includes(accountId)) : []), [findings, accountId]);
  const txs = useMemo(
    () => (accountId ? transactions.filter((t) => t.fromAccount === accountId || t.toAccount === accountId) : []),
    [transactions, accountId]
  );
  const counterparties = useMemo(() => {
    const m = new Map<string, { sent: number; received: number }>();
    txs.forEach((t) => {
      const other = t.fromAccount === accountId ? t.toAccount : t.fromAccount;
      const e = m.get(other) || { sent: 0, received: 0 };
      if (t.fromAccount === accountId) e.sent += t.amount;
      else e.received += t.amount;
      m.set(other, e);
    });
    return [...m.entries()].sort((a, b) => b[1].sent + b[1].received - (a[1].sent + a[1].received)).slice(0, 8);
  }, [txs, accountId]);

  return (
    <Modal open={!!accountId} onClose={onClose} side title={<span className="font-mono">{accountId}</span>}>
      {accountId && (
        <div className="space-y-6 p-5">
          <div className="flex items-center gap-5">
            <RiskGauge score={risk?.score || 0} size={104} />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-white">{risk?.holder || account?.accountHolder || "Unknown holder"}</p>
              <p className="text-sm capitalize text-slate-400">{account?.accountType || risk?.type || "Account"}</p>
              {(account?.country || risk?.country) && (
                <p className="mt-1 text-sm text-slate-400">{flag(account?.country || risk?.country)} {countryName(account?.country || risk?.country)}</p>
              )}
              {risk && <SeverityBadge level={risk.level} className="mt-2" />}
            </div>
          </div>

          <div className="flex gap-2">
            {onTrace && <Button size="sm" icon={<FiCrosshair />} onClick={() => onTrace(accountId)}>Trace funds</Button>}
            {onWatchlist && <Button size="sm" variant="secondary" icon={<FiEye />} onClick={() => onWatchlist(accountId)}>Add to watchlist</Button>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[0.03] p-3"><div className="label">Inflow</div><div className="mt-1 font-mono text-white">{formatMoney(risk?.inflow, currency)}</div><div className="text-xs text-slate-500">{risk?.received || 0} transfers</div></div>
            <div className="rounded-xl bg-white/[0.03] p-3"><div className="label">Outflow</div><div className="mt-1 font-mono text-white">{formatMoney(risk?.outflow, currency)}</div><div className="text-xs text-slate-500">{risk?.sent || 0} transfers</div></div>
          </div>

          {(account?.metadata?.email || account?.metadata?.mobile || account?.metadata?.ipAddress || account?.openedAt) && (
            <div>
              <p className="label mb-2">Identifiers</p>
              <div className="space-y-1.5 text-sm text-slate-300">
                {account?.metadata?.email && <p className="flex items-center gap-2"><FiMail className="text-slate-500" /> {account.metadata.email}</p>}
                {account?.metadata?.mobile && <p className="flex items-center gap-2"><FiPhone className="text-slate-500" /> {account.metadata.mobile}</p>}
                {account?.metadata?.ipAddress && <p className="flex items-center gap-2"><FiMonitor className="text-slate-500" /> {account.metadata.ipAddress}</p>}
                {account?.openedAt && <p className="text-slate-500">Opened {formatDate(account.openedAt)}</p>}
              </div>
            </div>
          )}

          <div>
            <p className="label mb-2">Findings ({related.length})</p>
            {related.length ? (
              <div className="space-y-2">
                {related.map((f) => (
                  <div key={f.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{f.label}</span>
                      <SeverityBadge level={f.severity} />
                    </div>
                    <p className="mt-1 text-sm text-slate-200">{f.title}</p>
                    {!f.subjects.includes(accountId) && <p className="mt-1 text-xs text-slate-500">Involved as counterparty</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No findings involve this account.</p>
            )}
          </div>

          {counterparties.length > 0 && (
            <div>
              <p className="label mb-2">Top counterparties</p>
              <div className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06]">
                {counterparties.map(([id, v]) => (
                  <button key={id} onClick={() => onAccount(id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/[0.03]">
                    <span className="font-mono text-slate-200">{id}</span>
                    <span className="font-mono text-xs">
                      {v.sent > 0 && <span className="text-sev-high">↑ {formatMoney(v.sent, currency, true)}</span>}
                      {v.sent > 0 && v.received > 0 && " "}
                      {v.received > 0 && <span className="text-accent">↓ {formatMoney(v.received, currency, true)}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="label mb-2">Recent transfers</p>
            <div className="space-y-1.5">
              {txs.slice(-12).reverse().map((t) => {
                const out = t.fromAccount === accountId;
                return (
                  <div key={t._id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <span className={out ? "text-sev-high" : "text-accent"}>{out ? "Sent to" : "Received from"}</span>{" "}
                      <span className="font-mono text-slate-200">{out ? t.toAccount : t.fromAccount}</span>
                      <div className="text-slate-500">{formatDateTime(t.date)}</div>
                    </div>
                    <span className={`font-mono ${t.isSuspicious ? "text-sev-critical" : "text-slate-200"}`}>{formatMoney(t.amount, currency)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
