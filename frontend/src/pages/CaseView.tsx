import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiGlobe,
  FiGrid,
  FiList,
  FiPrinter,
  FiShare2,
  FiSliders,
  FiTrash2,
  FiUsers,
  FiCrosshair,
  FiFileText as FiReport,
} from "react-icons/fi";
import { FundTrace } from "../components/case/FundTrace";
import { DetectionSettings } from "../components/case/DetectionSettings";
import { CaseLinks } from "../components/case/CaseLinks";
import { Checklist } from "../components/case/Checklist";
import { BenfordChart } from "../components/viz/BenfordChart";
import { PageContainer } from "../components/layout/AppShell";
import { Card, CardHeader, EmptyState } from "../components/ui/Card";
import { Button, LinkButton } from "../components/ui/Button";
import { SeverityBadge } from "../components/ui/Badge";
import { RiskGauge } from "../components/ui/RiskGauge";
import { StatTile } from "../components/ui/StatTile";
import { Tabs } from "../components/ui/Tabs";
import { PageLoader } from "../components/ui/Spinner";
import { Modal } from "../components/ui/Modal";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { NetworkGraph } from "../components/viz/NetworkGraph";
import { WorldMap } from "../components/viz/WorldMap";
import { ActivityChart, HorizontalBars, HourlyChart, SeverityDonut } from "../components/viz/Charts";
import { FindingCard, FindingsList } from "../components/case/FindingsList";
import { TransactionsTable, type TxFilter } from "../components/case/TransactionsTable";
import { AccountsTable } from "../components/case/AccountsTable";
import { AccountDrawer } from "../components/case/AccountDrawer";
import { api, type ApiError } from "../lib/api";
import { formatDate, formatMoney, formatNumber, SEVERITY, STATUS, typologyLabel, TYPOLOGY_INFO } from "../lib/format";
import { countryName, flag } from "../lib/countries";
import type { CaseDetail, CaseStatus, Finding, Transaction } from "../lib/types";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const TAB_KEYS = ["overview", "findings", "network", "trace", "transactions", "accounts", "geography", "notes"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const CaseView = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [drawerAccount, setDrawerAccount] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<TxFilter | null>(null);
  const [networkHighlight, setNetworkHighlight] = useState<{ ids: string[]; label: string } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [traceAccount, setTraceAccount] = useState<string | null>(null);

  const tabParam = params.get("tab") as TabKey | null;
  const tab: TabKey = tabParam && TAB_KEYS.includes(tabParam) ? tabParam : "overview";
  const setTab = useCallback(
    (t: string) => {
      setParams((p) => {
        const next = new URLSearchParams(p);
        if (t === "overview") next.delete("tab");
        else next.set("tab", t);
        return next;
      }, { replace: true });
    },
    [setParams]
  );

  useDocumentTitle(data ? data.name : "Case");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    Promise.all([api.getCase(id), api.getTransactions(id)])
      .then(([c, t]) => {
        if (cancelled) return;
        setData(c);
        setNotes(c.notes || "");
        setTransactions(t);
        const acc = new URLSearchParams(window.location.search).get("account");
        if (acc) setDrawerAccount(acc);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const accountsById = useMemo(() => new Map((data?.accounts || []).map((a) => [a.accountNumber, a])), [data]);
  const riskById = useMemo(() => new Map((data?.analysis.accountRisk || []).map((a) => [a.account, a])), [data]);

  if (error) {
    return (
      <PageContainer>
        {error.status === 404 ? (
          <Card>
            <EmptyState icon={<FiFileText />} title="Case not found" description="It may have been deleted, or it belongs to a different workspace." action={<LinkButton to="/cases">Back to cases</LinkButton>} />
          </Card>
        ) : (
          <ErrorPanel error={error} title="Could not load this case" />
        )}
      </PageContainer>
    );
  }
  if (!data) return <PageLoader label="Loading case" />;

  const { analysis, stats } = data;
  const currency = stats.currency;

  const update = async (patch: Partial<{ name: string; status: CaseStatus; notes: string }>) => {
    try {
      const res = await api.updateCase(data._id, patch);
      setData((d) => (d ? { ...d, ...res, analysis: d.analysis, accounts: d.accounts, notes: patch.notes ?? d.notes } : d));
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  };

  const remove = async () => {
    try {
      await api.deleteCase(data._id);
      toast.success("Case deleted");
      navigate("/cases");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const openAccount = (acc: string) => setDrawerAccount(acc);
  const openTrace = (acc: string) => {
    setDrawerAccount(null);
    setTraceAccount(acc);
    setTab("trace");
  };
  const addToWatchlist = async (acc: string) => {
    try {
      const res = await api.addWatchlist([{ type: "account", value: acc, note: `Added from ${data.caseId}`, source: "case" }]);
      toast.success(res.added ? `${acc} added to watchlist` : `${acc} is already on the watchlist`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };
  const showFindingTx = (f: Finding) => {
    setTxFilter({ ids: f.transactions, label: f.label });
    setTab("transactions");
  };
  const showFindingNetwork = (f: Finding) => {
    setNetworkHighlight({ ids: f.accounts, label: f.title });
    setSelectedAccount(null);
    setTab("network");
  };

  const reviewed = transactions.filter((t) => t.reviewStatus !== "unreviewed").length;
  const typologyBars = Object.entries(analysis.summary.byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ label: typologyLabel(type), value: count, hint: TYPOLOGY_INFO[type]?.help }));

  const tabs = [
    { key: "overview", label: "Overview", icon: <FiGrid /> },
    { key: "findings", label: "Findings", icon: <FiAlertTriangle />, count: analysis.findings.length },
    { key: "network", label: "Network", icon: <FiShare2 /> },
    { key: "trace", label: "Trace funds", icon: <FiCrosshair /> },
    { key: "transactions", label: "Transactions", icon: <FiList />, count: stats.transactionCount },
    { key: "accounts", label: "Accounts", icon: <FiUsers />, count: stats.accountCount },
    { key: "geography", label: "Geography", icon: <FiGlobe /> },
    { key: "notes", label: "Workflow", icon: <FiEdit2 />, count: data.checklist?.length ? data.checklist.filter((c) => !c.done).length : undefined },
  ];

  return (
    <PageContainer className="!pt-6">
      <Link to="/cases" className="no-print mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <FiArrowLeft /> All cases
      </Link>

      {/* Header */}
      <Card className="relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: `${SEVERITY[data.riskLevel].color}14` }} />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
          <RiskGauge score={data.riskScore} size={128} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{data.caseId}</span>
              <SeverityBadge level={data.riskLevel} />
            </div>
            {editingName ? (
              <form
                className="mt-1.5 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await update({ name: nameDraft })) setEditingName(false);
                }}
              >
                <input autoFocus className="input font-display text-xl font-semibold" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={120} />
                <Button type="submit" icon={<FiCheck />} aria-label="Save name" />
              </form>
            ) : (
              <h1 className="group mt-1 flex items-center gap-2 font-display text-2xl font-bold text-white sm:text-3xl">
                <span className="truncate">{data.name}</span>
                <button
                  onClick={() => {
                    setNameDraft(data.name);
                    setEditingName(true);
                  }}
                  className="no-print rounded-lg p-1.5 text-base text-slate-500 opacity-0 transition hover:bg-white/[0.06] hover:text-white group-hover:opacity-100"
                  aria-label="Rename case"
                >
                  <FiEdit2 />
                </button>
              </h1>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              {stats.dateRange && (
                <span className="flex items-center gap-1.5"><FiCalendar className="text-slate-500" /> {formatDate(stats.dateRange.start)} – {formatDate(stats.dateRange.end)}</span>
              )}
              {data.sourceFile && <span className="flex items-center gap-1.5"><FiFileText className="text-slate-500" /> {data.sourceFile}</span>}
              <span className="text-slate-500">Analysed {formatDate(data.analyzedAt || data.createdAt, false)}</span>
              {data.thresholds && (
                <button onClick={() => setSettingsOpen(true)} className="no-print rounded-md bg-violet-400/10 px-2 py-0.5 text-xs text-violet-300 ring-1 ring-violet-400/30">
                  Custom detection settings
                </button>
              )}
            </div>
          </div>
          <div className="no-print flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
            <select
              value={data.status}
              onChange={(e) => update({ status: e.target.value as CaseStatus }).then((ok) => ok && toast.success("Status updated"))}
              className="input w-auto py-2"
              aria-label="Case status"
            >
              {(Object.keys(STATUS) as CaseStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS[s].label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <LinkButton to={`/cases/${data._id}/report`} size="sm" icon={<FiReport />}>SAR report</LinkButton>
              <Button variant="secondary" size="sm" icon={<FiSliders />} onClick={() => setSettingsOpen(true)} aria-label="Detection settings" title="Detection settings" />
            </div>
            <div className="flex gap-2">
              <LinkButton to={api.exportUrl(data._id, "csv")} download variant="secondary" size="sm" icon={<FiDownload />}>CSV</LinkButton>
              <LinkButton to={api.exportUrl(data._id, "json")} download variant="secondary" size="sm" icon={<FiDownload />}>JSON</LinkButton>
              <Button variant="secondary" size="sm" icon={<FiPrinter />} onClick={() => window.print()} aria-label="Print report" />
              <Button variant="danger" size="sm" icon={<FiTrash2 />} onClick={() => setConfirmDelete(true)} aria-label="Delete case" />
            </div>
          </div>
        </div>
      </Card>

      {data.warnings?.length > 0 && (
        <div className="mt-4 rounded-2xl border border-sev-medium/25 bg-sev-medium/[0.05] px-5 py-3 text-sm text-slate-300">
          <p className="flex items-center gap-2 font-medium text-sev-medium"><FiAlertTriangle /> Data quality notes</p>
          <ul className="mt-1.5 space-y-0.5 text-xs text-slate-400">
            {data.warnings.slice(0, 6).map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        </div>
      )}

      <div className="no-print"><CaseLinks caseId={data._id} refreshKey={data.analyzedAt} /></div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total volume" value={formatMoney(stats.totalVolume, currency, true)} hint={`avg ${formatMoney(stats.averageAmount, currency)} · max ${formatMoney(stats.maxAmount, currency, true)}`} />
        <StatTile label="Transfers" value={formatNumber(stats.transactionCount)} hint={`${formatNumber(stats.flaggedTransactions)} flagged · ${reviewed} reviewed`} />
        <StatTile label="Accounts" value={formatNumber(stats.accountCount)} hint={`${analysis.summary.highRiskAccounts} high-risk`} />
        <StatTile label="Findings" value={analysis.summary.totalFindings} tone={analysis.summary.severity.critical ? "danger" : "default"} hint={`${analysis.summary.severity.critical} critical · ${analysis.summary.severity.high} high`} />
      </div>

      <div className="no-print mt-8">
        <Tabs tabs={tabs} active={tab} onChange={setTab} layoutId="case-tabs" />
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mt-6">
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Activity over time" subtitle="Daily volume, transfer count and flagged transfers" icon={<FiActivity />} />
              <div className="px-3 pb-4">
                {analysis.activity.daily.length ? <ActivityChart data={analysis.activity.daily} currency={currency} /> : <EmptyState title="No dates in this dataset" description="Add a date column to unlock the timeline." />}
              </div>
            </Card>
            <Card>
              <CardHeader title="Findings by severity" icon={<FiAlertTriangle />} />
              <div className="flex flex-col items-center gap-5 px-5 pb-6">
                <SeverityDonut counts={analysis.summary.severity} />
                <div className="grid w-full grid-cols-2 gap-2">
                  {(["critical", "high", "medium", "low"] as const).map((s) => (
                    <div key={s} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: SEVERITY[s].color }} />{SEVERITY[s].label}</span>
                      <span className="font-semibold text-white">{analysis.summary.severity[s]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="Top findings"
                subtitle="Highest-severity patterns detected"
                icon={<FiAlertTriangle />}
                action={analysis.findings.length > 4 && <Button variant="ghost" size="sm" onClick={() => setTab("findings")}>View all {analysis.findings.length}</Button>}
              />
              <div className="space-y-2.5 px-5 pb-5">
                {analysis.findings.length ? (
                  analysis.findings.slice(0, 4).map((f) => (
                    <FindingCard key={f.id} finding={f} currency={currency} onAccount={openAccount} onTransactions={showFindingTx} onNetwork={showFindingNetwork} />
                  ))
                ) : (
                  <EmptyState icon="✓" title="No suspicious patterns" description="None of the detectors fired for this dataset." />
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Riskiest accounts" icon={<FiUsers />} action={<Button variant="ghost" size="sm" onClick={() => setTab("accounts")}>All</Button>} />
              <div className="space-y-1 px-3 pb-4">
                {analysis.accountRisk.slice(0, 7).map((a) => (
                  <button key={a.account} onClick={() => openAccount(a.account)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.04]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold" style={{ background: `${SEVERITY[a.level].color}1a`, color: SEVERITY[a.level].color }}>
                      {a.score}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm text-white">{a.account}</div>
                      <div className="truncate text-xs text-slate-500">{a.reasons.join(" · ") || "No findings"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Time-of-day profile" subtitle="Transfers per hour - off-hours highlighted" icon={<FiActivity />} />
              <div className="px-3 pb-4">
                <HourlyChart data={analysis.activity.hourly} height={260} />
              </div>
            </Card>
            {analysis.benford && analysis.benford.n >= 30 && (
              <Card>
                <CardHeader title="Benford's law test" subtitle="Forensic check of first-digit distribution" icon={<FiActivity />} />
                <div className="px-5 pb-5">
                  <BenfordChart data={analysis.benford} minCount={data.settings?.BENFORD?.minCount} />
                </div>
              </Card>
            )}
            <Card className={analysis.benford && analysis.benford.n >= 30 ? "lg:col-span-3" : ""}>
              <CardHeader title="Typologies detected" icon={<FiList />} />
              <div className={analysis.benford && analysis.benford.n >= 30 ? "grid gap-x-8 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3 [&>*]:mb-0" : "px-5 pb-5"}>
                {typologyBars.length ? (
                  analysis.benford && analysis.benford.n >= 30 ? (
                    [0, 1, 2].map((col) => <HorizontalBars key={col} data={typologyBars.filter((_, i) => i % 3 === col)} />)
                  ) : (
                    <HorizontalBars data={typologyBars} />
                  )
                ) : (
                  <p className="text-sm text-slate-500">None.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === "findings" && (
          <Card className="p-5">
            <FindingsList findings={analysis.findings} currency={currency} onAccount={openAccount} onTransactions={showFindingTx} onNetwork={showFindingNetwork} />
          </Card>
        )}

        {tab === "network" && (
          <Card>
            <CardHeader
              title="Money-flow network"
              subtitle="Node size = volume · colour = risk · arrows show direction. Drag nodes, scroll to zoom, click to inspect."
              icon={<FiShare2 />}
              action={
                networkHighlight && (
                  <button onClick={() => setNetworkHighlight(null)} className="max-w-xs truncate rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs text-accent ring-1 ring-accent/25">
                    Highlight: {networkHighlight.label} ✕
                  </button>
                )
              }
            />
            <div className="px-3 pb-3 sm:px-5 sm:pb-5">
              <NetworkGraph
                nodes={analysis.network.nodes}
                edges={analysis.network.edges}
                highlight={networkHighlight?.ids}
                selected={selectedAccount}
                onSelect={setSelectedAccount}
                currency={currency}
              />
              {selectedAccount && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm">
                  <span>
                    Selected <span className="font-mono text-white">{selectedAccount}</span>
                    {riskById.get(selectedAccount) && <span className="ml-2 text-slate-500">risk {riskById.get(selectedAccount)!.score}</span>}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openAccount(selectedAccount)}>Account details</Button>
                    <Button size="sm" variant="secondary" icon={<FiCrosshair />} onClick={() => openTrace(selectedAccount)}>Trace funds</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setTxFilter({ account: selectedAccount, label: `Account ${selectedAccount}` }); setTab("transactions"); }}>Transfers</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {tab === "trace" && (
          <FundTrace
            caseId={data._id}
            accounts={analysis.accountRisk}
            initialAccount={traceAccount || analysis.findings.find((f) => f.type === "passThrough" || f.type === "fanIn")?.subjects[0] || analysis.accountRisk[0]?.account}
            currency={currency}
            onAccount={openAccount}
          />
        )}

        {tab === "transactions" && (
          <Card className="pt-5">
            <TransactionsTable
              caseId={data._id}
              transactions={transactions}
              currency={currency}
              filter={txFilter}
              onClearFilter={() => setTxFilter(null)}
              onAccount={openAccount}
              onChange={(tx) => setTransactions((ts) => ts.map((t) => (t._id === tx._id ? tx : t)))}
            />
          </Card>
        )}

        {tab === "accounts" && (
          <Card className="pt-5">
            <AccountsTable accounts={analysis.accountRisk} onSelect={openAccount} currency={currency} />
          </Card>
        )}

        {tab === "geography" && (
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Geographic exposure" subtitle="Where transfers originate" icon={<FiGlobe />} />
              <div className="px-5 pb-5">
                <WorldMap data={analysis.geography} currency={currency} highRiskList={analysis.thresholds.highRiskCountries} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Countries" icon={<FiGlobe />} />
              <div className="px-5 pb-5">
                {analysis.geography.length ? (
                  <div className="space-y-1">
                    {analysis.geography.map((g) => (
                      <div key={g.country} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-white">{flag(g.country)} {countryName(g.country)}</div>
                          <div className="text-xs text-slate-500">{g.count} transfers{g.flagged ? ` · ${g.flagged} flagged` : ""}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm text-slate-200">{formatMoney(g.volume, currency, true)}</div>
                          {g.highRisk && <span className="text-[11px] font-semibold text-sev-critical">HIGH RISK</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No country data" description="Add a country column (ISO code) to map geographic exposure." />
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === "notes" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-1 font-display font-semibold text-white">Investigation checklist</h3>
              <p className="mb-4 text-xs text-slate-500">Next steps suggested from the findings. Progress is saved to the case.</p>
              <Checklist caseId={data._id} items={data.checklist || []} onChange={(items) => setData((d) => (d ? { ...d, checklist: items } : d))} />
            </Card>
            <Card className="p-5">
              <label htmlFor="notes" className="mb-1 block font-display font-semibold text-white">Investigator notes</label>
              <p className="mb-4 text-xs text-slate-500">Hypotheses, evidence and decisions. Included in the SAR report.</p>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={10000}
                rows={14}
                className="input resize-y font-mono leading-relaxed"
                placeholder={"Record hypotheses, evidence and next steps.\n\n- Contacted bank re: ACC1015\n- SAR drafted"}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">{notes.length.toLocaleString()} / 10,000</span>
                <Button
                  loading={savingNotes}
                  disabled={notes === data.notes}
                  onClick={async () => {
                    setSavingNotes(true);
                    if (await update({ notes })) toast.success("Notes saved");
                    setSavingNotes(false);
                  }}
                >
                  Save notes
                </Button>
              </div>
            </Card>
          </div>
        )}
      </motion.div>

      <AccountDrawer
        accountId={drawerAccount}
        onClose={() => setDrawerAccount(null)}
        risk={drawerAccount ? riskById.get(drawerAccount) : undefined}
        account={drawerAccount ? accountsById.get(drawerAccount) : undefined}
        findings={analysis.findings}
        transactions={transactions}
        currency={currency}
        onAccount={setDrawerAccount}
        onTrace={openTrace}
        onWatchlist={addToWatchlist}
      />

      <DetectionSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        data={data}
        onUpdated={(c) => {
          setData(c);
          api.getTransactions(c._id).then(setTransactions).catch(() => undefined);
        }}
      />

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete case?">
        <div className="p-5">
          <p className="text-sm text-slate-400">This permanently removes the case, its accounts and all transactions.</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" icon={<FiTrash2 />} onClick={remove}>Delete</Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default CaseView;
