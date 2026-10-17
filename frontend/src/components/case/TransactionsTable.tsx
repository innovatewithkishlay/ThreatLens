import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { toast } from "react-hot-toast";
import { FiCheck, FiChevronLeft, FiChevronRight, FiFlag, FiSearch, FiX, FiArrowDown, FiArrowUp } from "react-icons/fi";
import type { ReviewStatus, Transaction } from "../../lib/types";
import { formatDateTime, formatMoney, typologyLabel } from "../../lib/format";
import { flag } from "../../lib/countries";
import { api } from "../../lib/api";

export interface TxFilter {
  ids?: string[];
  account?: string;
  label?: string;
}

const PAGE = 25;

const REVIEW: Record<ReviewStatus, { label: string; cls: string }> = {
  unreviewed: { label: "Unreviewed", cls: "text-slate-500" },
  suspicious: { label: "Suspicious", cls: "text-sev-critical" },
  cleared: { label: "Cleared", cls: "text-accent" },
};

export const TransactionsTable = ({
  caseId,
  transactions,
  onChange,
  filter,
  onClearFilter,
  onAccount,
  currency,
}: {
  caseId: string;
  transactions: Transaction[];
  onChange: (tx: Transaction) => void;
  filter?: TxFilter | null;
  onClearFilter?: () => void;
  onAccount?: (id: string) => void;
  currency?: string;
}) => {
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"all" | "flagged" | ReviewStatus>("all");
  const [sort, setSort] = useState<{ key: "date" | "amount"; dir: 1 | -1 }>({ key: "date", dir: 1 });
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
  }, [query, show, filter, sort]);

  const rows = useMemo(() => {
    const ids = filter?.ids ? new Set(filter.ids) : null;
    const q = query.trim().toLowerCase();
    return transactions
      .filter((t) => !ids || ids.has(t._id))
      .filter((t) => !filter?.account || t.fromAccount === filter.account || t.toAccount === filter.account)
      .filter((t) => (show === "all" ? true : show === "flagged" ? t.isSuspicious : t.reviewStatus === show))
      .filter(
        (t) =>
          !q ||
          [t.fromAccount, t.toAccount, t.reference, t.description, t.country, String(t.amount)].some((v) => v?.toLowerCase().includes(q))
      )
      .sort((a, b) =>
        sort.key === "amount"
          ? (a.amount - b.amount) * sort.dir
          : ((a.date ? +new Date(a.date) : 0) - (b.date ? +new Date(b.date) : 0)) * sort.dir
      );
  }, [transactions, filter, query, show, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice(page * PAGE, page * PAGE + PAGE);

  const review = async (t: Transaction, status: ReviewStatus) => {
    const next = t.reviewStatus === status ? "unreviewed" : status;
    setBusy(t._id);
    try {
      onChange(await api.reviewTransaction(caseId, t._id, next));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const SortIcon = ({ k }: { k: "date" | "amount" }) => (sort.key === k ? sort.dir === 1 ? <FiArrowUp /> : <FiArrowDown /> : null);
  const toggleSort = (key: "date" | "amount") => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "amount" ? -1 : 1 }));

  return (
    <div>
      <div className="flex flex-col gap-3 px-5 pb-4 lg:flex-row lg:items-center">
        {filter && (
          <span className="inline-flex items-center gap-2 self-start rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs text-accent ring-1 ring-accent/25">
            {filter.label || "Filtered"}
            <button onClick={onClearFilter} aria-label="Clear filter" className="hover:text-white"><FiX /></button>
          </span>
        )}
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search account, reference, amount, country…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="input w-auto" value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Show">
          <option value="all">All transfers</option>
          <option value="flagged">Flagged by engine</option>
          <option value="suspicious">Marked suspicious</option>
          <option value="cleared">Cleared</option>
          <option value="unreviewed">Unreviewed</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-y border-white/[0.06] bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5 font-semibold">
                <button className="flex items-center gap-1 uppercase hover:text-white" onClick={() => toggleSort("date")}>Date <SortIcon k="date" /></button>
              </th>
              <th className="px-3 py-2.5 font-semibold">From → To</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                <button className="ml-auto flex items-center gap-1 uppercase hover:text-white" onClick={() => toggleSort("amount")}>Amount <SortIcon k="amount" /></button>
              </th>
              <th className="px-3 py-2.5 font-semibold">Country</th>
              <th className="px-3 py-2.5 font-semibold">Signals</th>
              <th className="px-5 py-2.5 text-right font-semibold">Review</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((t) => (
              <tr key={t._id} className={clsx("border-b border-white/[0.04] transition hover:bg-white/[0.02]", t.isSuspicious && "bg-sev-critical/[0.025]")}>
                <td className="whitespace-nowrap px-5 py-3">
                  <div className="text-slate-200">{formatDateTime(t.date)}</div>
                  {t.reference && <div className="font-mono text-[11px] text-slate-600">{t.reference}</div>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <button onClick={() => onAccount?.(t.fromAccount)} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-slate-200 hover:text-accent">{t.fromAccount}</button>
                    <span className="text-slate-600">→</span>
                    <button onClick={() => onAccount?.(t.toAccount)} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-slate-200 hover:text-accent">{t.toAccount}</button>
                  </div>
                  {t.description && <div className="mt-0.5 max-w-[260px] truncate text-xs text-slate-500">{t.description}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-slate-100">{formatMoney(t.amount, t.currency || currency)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-400">{t.country ? `${flag(t.country)} ${t.country}` : "—"}</td>
                <td className="px-3 py-3">
                  <div className="flex max-w-[240px] flex-wrap gap-1">
                    {t.flags.length ? (
                      t.flags.slice(0, 3).map((f) => (
                        <span key={f} className="rounded-md bg-sev-high/10 px-1.5 py-0.5 text-[11px] text-sev-high ring-1 ring-sev-high/20">{typologyLabel(f)}</span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                    {t.flags.length > 3 && <span className="text-[11px] text-slate-500">+{t.flags.length - 3}</span>}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <span className={clsx("mr-1 hidden text-xs xl:inline", REVIEW[t.reviewStatus].cls)}>{REVIEW[t.reviewStatus].label}</span>
                    <button
                      disabled={busy === t._id}
                      onClick={() => review(t, "suspicious")}
                      className={clsx("rounded-lg p-1.5 transition", t.reviewStatus === "suspicious" ? "bg-sev-critical/20 text-sev-critical" : "text-slate-500 hover:bg-white/[0.06] hover:text-sev-critical")}
                      title="Mark suspicious"
                      aria-label="Mark suspicious"
                    >
                      <FiFlag />
                    </button>
                    <button
                      disabled={busy === t._id}
                      onClick={() => review(t, "cleared")}
                      className={clsx("rounded-lg p-1.5 transition", t.reviewStatus === "cleared" ? "bg-accent/20 text-accent" : "text-slate-500 hover:bg-white/[0.06] hover:text-accent")}
                      title="Mark cleared"
                      aria-label="Mark cleared"
                    >
                      <FiCheck />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!slice.length && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">No transfers match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-5 py-4 text-xs text-slate-500">
        <span>
          {rows.length ? `${page * PAGE + 1}–${Math.min(rows.length, (page + 1) * PAGE)} of ${rows.length.toLocaleString()}` : "0 results"}
        </span>
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-1.5 hover:bg-white/[0.06] disabled:opacity-30" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><FiChevronLeft /></button>
          <span className="px-2 tabular-nums">{page + 1} / {pages}</span>
          <button className="rounded-lg p-1.5 hover:bg-white/[0.06] disabled:opacity-30" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><FiChevronRight /></button>
        </div>
      </div>
    </div>
  );
};
