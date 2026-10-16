import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { FiAlertTriangle, FiFolder, FiGitMerge, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { PageContainer, PageHeader } from "../components/layout/AppShell";
import { Card, EmptyState } from "../components/ui/Card";
import { Button, LinkButton } from "../components/ui/Button";
import { SeverityBadge, StatusBadge } from "../components/ui/Badge";
import { RiskBar } from "../components/ui/RiskGauge";
import { PageLoader } from "../components/ui/Spinner";
import { Modal } from "../components/ui/Modal";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { StatTile } from "../components/ui/StatTile";
import { api, type ApiError } from "../lib/api";
import { formatMoney, formatNumber, riskColor, timeAgo } from "../lib/format";
import type { CaseStatus, CaseSummary } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const FILTERS: { key: "all" | CaseStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "investigating", label: "Investigating" },
  { key: "escalated", label: "Escalated" },
  { key: "closed", label: "Closed" },
];

const Cases = () => {
  useDocumentTitle("Cases");
  const navigate = useNavigate();
  const { user, googleEnabled, signIn } = useAuth();
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CaseStatus>("all");
  const [sort, setSort] = useState<"recent" | "risk">("recent");
  const [selected, setSelected] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<CaseSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.listCases().then(setCases).catch(setError);
  }, []);

  const visible = useMemo(() => {
    if (!cases) return [];
    const q = query.trim().toLowerCase();
    return cases
      .filter((c) => filter === "all" || c.status === filter)
      .filter((c) => !q || [c.name, c.caseId, c.sourceFile].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => (sort === "risk" ? b.riskScore - a.riskScore : +new Date(b.createdAt) - +new Date(a.createdAt)));
  }, [cases, query, filter, sort]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteCase(toDelete._id);
      setCases((cs) => cs?.filter((c) => c._id !== toDelete._id) || null);
      setSelected((s) => s.filter((x) => x !== toDelete._id));
      toast.success("Case deleted");
      setToDelete(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  if (error) return <PageContainer><ErrorPanel error={error} title="Could not load cases" /></PageContainer>;
  if (!cases) return <PageLoader label="Loading cases" />;

  const totals = {
    cases: cases.length,
    critical: cases.filter((c) => c.riskLevel === "critical" || c.riskLevel === "high").length,
    findings: cases.reduce((s, c) => s + (c.analysis?.summary?.totalFindings || 0), 0),
    volume: cases.reduce((s, c) => s + (c.stats?.totalVolume || 0), 0),
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Workspace"
        title="Cases"
        description={user ? `Investigations saved to ${user.email}.` : "Investigations in this browser's private guest workspace."}
        actions={
          <>
            {selected.length === 2 && (
              <Button variant="outline" icon={<FiGitMerge />} onClick={() => navigate(`/compare/${selected[0]}/${selected[1]}`)}>
                Compare selected
              </Button>
            )}
            <LinkButton to="/analyze" icon={<FiPlus />}>
              New case
            </LinkButton>
          </>
        }
      />

      {!user && googleEnabled && cases.length > 0 && (
        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/[0.04] px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-300">Sign in to keep these cases across devices - they'll move to your account automatically.</p>
          <Button size="sm" variant="outline" onClick={signIn}>Sign in with Google</Button>
        </div>
      )}

      {cases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FiFolder />}
            title="No cases yet"
            description="Upload a transaction CSV to create your first investigation, or try the demo dataset."
            action={<LinkButton to="/analyze" icon={<FiPlus />}>Analyze transactions</LinkButton>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Cases" value={totals.cases} />
            <StatTile label="High / critical" value={totals.critical} tone={totals.critical ? "danger" : "default"} />
            <StatTile label="Findings" value={formatNumber(totals.findings)} />
            <StatTile label="Volume analysed" value={formatMoney(totals.volume, undefined, true)} />
          </div>

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-sm transition",
                    filter === f.key ? "bg-accent/10 text-accent ring-1 ring-accent/30" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 lg:w-72">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input className="input pl-9" placeholder="Search cases" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as "recent" | "risk")} aria-label="Sort cases">
                <option value="recent">Newest</option>
                <option value="risk">Highest risk</option>
              </select>
            </div>
          </div>

          {selected.length > 0 && (
            <p className="mb-3 text-xs text-slate-500">
              {selected.length}/2 selected for comparison{selected.length === 1 && " - pick one more case"}.
            </p>
          )}

          {visible.length === 0 ? (
            <Card><EmptyState icon={<FiSearch />} title="No matching cases" description="Try a different search or filter." /></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((c, i) => {
                const isSel = selected.includes(c._id);
                return (
                  <motion.div key={c._id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
                    <Card className={clsx("card-hover group relative flex h-full flex-col p-5", isSel && "border-accent/50 ring-1 ring-accent/30")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-slate-500">{c.caseId}</p>
                          <Link to={`/cases/${c._id}`} className="mt-1 block truncate font-display text-lg font-semibold text-white after:absolute after:inset-0 hover:text-accent">
                            {c.name}
                          </Link>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-2xl font-bold tabular-nums" style={{ color: riskColor(c.riskScore) }}>{c.riskScore}</div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">risk</div>
                        </div>
                      </div>
                      <RiskBar score={c.riskScore} className="mt-3" />
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <SeverityBadge level={c.riskLevel} />
                        <StatusBadge status={c.status} />
                        {(c.analysis?.summary?.totalFindings || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <FiAlertTriangle className="text-sev-high" /> {c.analysis?.summary.totalFindings} findings
                          </span>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.05] pt-4 text-center">
                        <div><div className="text-sm font-semibold text-white">{formatNumber(c.stats.transactionCount)}</div><div className="text-[11px] text-slate-500">transfers</div></div>
                        <div><div className="text-sm font-semibold text-white">{formatNumber(c.stats.accountCount)}</div><div className="text-[11px] text-slate-500">accounts</div></div>
                        <div><div className="text-sm font-semibold text-white">{formatMoney(c.stats.totalVolume, c.stats.currency, true)}</div><div className="text-[11px] text-slate-500">volume</div></div>
                      </div>
                      <div className="relative z-10 mt-4 flex items-center justify-between text-xs text-slate-500">
                        <span>{timeAgo(c.createdAt)}</span>
                        <div className="flex items-center gap-1">
                          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-white/[0.05]">
                            <input type="checkbox" checked={isSel} onChange={() => toggle(c._id)} className="accent-[#00ff9d]" />
                            Compare
                          </label>
                          <button onClick={() => setToDelete(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-sev-critical/10 hover:text-sev-critical" aria-label={`Delete ${c.name}`}>
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal open={!!toDelete} onClose={() => !deleting && setToDelete(null)} title="Delete case?">
        <div className="p-5">
          <p className="text-sm text-slate-400">
            <span className="font-semibold text-white">{toDelete?.name}</span> and all of its transactions will be permanently removed. This cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting} icon={<FiTrash2 />}>Delete case</Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Cases;
