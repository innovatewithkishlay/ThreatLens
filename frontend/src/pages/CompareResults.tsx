import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import { FiArrowLeft, FiArrowRight, FiCalendar, FiClock, FiGitMerge, FiGlobe, FiLink, FiShare2, FiUsers } from "react-icons/fi";
import { PageContainer } from "../components/layout/AppShell";
import { Card, CardHeader, EmptyState } from "../components/ui/Card";
import { LinkButton } from "../components/ui/Button";
import { SeverityBadge } from "../components/ui/Badge";
import { RiskGauge } from "../components/ui/RiskGauge";
import { PageLoader } from "../components/ui/Spinner";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { NetworkGraph } from "../components/viz/NetworkGraph";
import { api, type ApiError } from "../lib/api";
import { formatDate, formatMoney, formatNumber, riskColor, SEVERITY, typologyLabel } from "../lib/format";
import { countryName, flag } from "../lib/countries";
import type { ComparisonCase, ComparisonResponse } from "../lib/types";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const CaseCard = ({ c, tag, color }: { c: ComparisonCase; tag: string; color: string }) => (
  <Link to={`/cases/${c._id}`} className="card card-hover block p-4">
    <div className="flex items-center justify-between">
      <span className="rounded-md px-2 py-0.5 text-xs font-bold text-ink-950" style={{ background: color }}>{tag}</span>
      <span className="font-display text-xl font-bold" style={{ color: riskColor(c.riskScore) }}>{c.riskScore}</span>
    </div>
    <div className="mt-2 truncate font-semibold text-white">{c.name}</div>
    <div className="font-mono text-xs text-slate-500">{c.caseId}</div>
    <div className="mt-2 text-xs text-slate-400">{formatNumber(c.stats.transactionCount)} transfers · {formatNumber(c.stats.accountCount)} accounts</div>
  </Link>
);

const Meter = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="mb-1 flex justify-between text-sm"><span className="text-slate-300">{label}</span><span className="font-mono text-xs text-slate-400">{Math.round(value * 100)}%</span></div>
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
      <div className="h-full rounded-full bg-gradient-to-r from-accent to-cyan-glow" style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  </div>
);

const CompareResults = () => {
  const { a = "", b = "" } = useParams();
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  useDocumentTitle("Cross-case report");

  useEffect(() => {
    setData(null);
    api.compare(a, b).then(setData).catch(setError);
  }, [a, b]);

  if (error)
    return (
      <PageContainer>
        <ErrorPanel error={error} title="Comparison failed" />
        <LinkButton to="/compare" variant="secondary" className="mt-4" icon={<FiArrowLeft />}>Back</LinkButton>
      </PageContainer>
    );
  if (!data) return <PageLoader label="Linking cases" />;

  const { caseA, caseB, comparison: c } = data;
  const fmtRange = (r: { start: string; end: string } | null) => (r ? `${formatDate(r.start)} – ${formatDate(r.end)}` : "No dates");

  return (
    <PageContainer className="!pt-6">
      <Link to="/compare" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><FiArrowLeft /> New comparison</Link>

      <Card className="relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-cyan-glow/10 blur-3xl" />
        <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <CaseCard c={caseA} tag="A" color="#00ff9d" />
          <div className="flex flex-col items-center gap-2 text-center">
            <RiskGauge score={c.linkScore} size={136} label="Link" />
            <SeverityBadge level={c.linkLevel} />
          </div>
          <CaseCard c={caseB} tag="B" color="#22d3ee" />
        </div>
        <p className="relative mx-auto mt-6 max-w-2xl text-center text-slate-300">{c.verdict}</p>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Link score breakdown" icon={<FiLink />} />
          <div className="space-y-3 px-5 pb-5">
            {c.factors.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">{f.label}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-slate-500">{f.key === "patternSimilarity" ? `${Math.round(f.value * 100)}%` : f.value}</span>
                  <span className={clsx("w-10 rounded-md px-1.5 py-0.5 text-center font-mono text-xs", f.points ? "bg-accent/10 text-accent" : "bg-white/[0.04] text-slate-600")}>+{f.points}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pattern similarity" subtitle="Cosine similarity of behavioural profiles" icon={<FiGitMerge />} />
          <div className="space-y-4 px-5 pb-5">
            <Meter label="Typologies" value={c.similarity.typologies} />
            <Meter label="Amount distribution" value={c.similarity.amounts} />
            <Meter label="Time of day" value={c.similarity.timeOfDay} />
            {c.commonTypologies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {c.commonTypologies.map((t) => <span key={t} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-xs text-slate-300">{typologyLabel(t)}</span>)}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Timeline & geography" icon={<FiCalendar />} />
          <div className="space-y-4 px-5 pb-5 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-accent">Case A</span><span className="text-slate-400">{fmtRange(c.temporal.caseA)}</span></div>
              <div className="flex justify-between"><span className="text-cyan-glow">Case B</span><span className="text-slate-400">{fmtRange(c.temporal.caseB)}</span></div>
              <div className="flex justify-between border-t border-white/[0.05] pt-2">
                <span className="text-slate-300">Overlap</span>
                <span className={c.temporal.overlap ? "text-white" : "text-slate-500"}>{c.temporal.overlap ? `${c.temporal.overlap.days} days` : "None"}</span>
              </div>
            </div>
            <div>
              <p className="label mb-1.5 flex items-center gap-1.5"><FiGlobe /> Common countries</p>
              {c.geography.commonCountries.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.geography.commonCountries.map((cc) => (
                    <span key={cc} className={clsx("rounded-md px-2 py-0.5 text-xs", c.geography.commonHighRisk.includes(cc) ? "bg-sev-critical/10 text-sev-critical ring-1 ring-sev-critical/25" : "bg-white/[0.05] text-slate-300")} title={countryName(cc)}>
                      {flag(cc)} {cc}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">None</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Shared accounts" subtitle="Accounts that appear in both cases" icon={<FiUsers />} />
          {c.sharedAccounts.length ? (
            <div className="overflow-x-auto pb-2">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="border-y border-white/[0.06] bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2 font-semibold">Account</th>
                    <th className="px-3 py-2 text-right font-semibold text-accent">Case A</th>
                    <th className="px-5 py-2 text-right font-semibold text-cyan-glow">Case B</th>
                  </tr>
                </thead>
                <tbody>
                  {c.sharedAccounts.map((s) => (
                    <tr key={s.account} className="border-b border-white/[0.04]">
                      <td className="px-5 py-2.5 font-mono text-white">{s.account}</td>
                      {[s.caseA, s.caseB].map((p, i) => (
                        <td key={i} className={clsx("py-2.5 text-right text-xs", i ? "px-5" : "px-3")}>
                          <div className="font-mono text-slate-200">↓{formatMoney(p.inflow, undefined, true)} ↑{formatMoney(p.outflow, undefined, true)}</div>
                          <div style={{ color: SEVERITY[p.level].color }}>risk {p.score}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No shared accounts" className="!py-8" />
          )}
        </Card>

        <Card>
          <CardHeader title="Shared identifiers" subtitle="Same email, phone or IP used in both cases" icon={<FiLink />} />
          {c.sharedIdentifiers.length ? (
            <div className="space-y-2 px-5 pb-5">
              {c.sharedIdentifiers.map((s, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="label">{s.label}</span>
                    <span className="truncate font-mono text-sm text-white">{s.value}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-xs">
                    {s.accountsA.map((x) => <span key={`a${x}`} className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">A · {x}</span>)}
                    {s.accountsB.map((x) => <span key={`b${x}`} className="rounded bg-cyan-glow/10 px-1.5 py-0.5 text-cyan-glow">B · {x}</span>)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No shared identifiers" className="!py-8" />
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Cross-case money flows" subtitle="Funds received in one case and moved on in the other" icon={<FiArrowRight />} />
        {c.crossCaseFlows.length ? (
          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-white/[0.06] bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-2 font-semibold">Direction</th>
                  <th className="px-3 py-2 font-semibold">Path</th>
                  <th className="px-3 py-2 text-right font-semibold">In → Out</th>
                  <th className="px-5 py-2 text-right font-semibold">Gap</th>
                </tr>
              </thead>
              <tbody>
                {c.crossCaseFlows.slice(0, 30).map((f, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="px-5 py-2.5"><span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-xs text-slate-300">{f.direction}</span></td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      <span className="text-slate-300">{f.path[0]}</span>
                      <span className="mx-1.5 text-slate-600">→</span>
                      <span className="rounded bg-sev-high/10 px-1.5 py-0.5 text-sev-high">{f.path[1]}</span>
                      <span className="mx-1.5 text-slate-600">→</span>
                      <span className="text-slate-300">{f.path[2]}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-200">{formatMoney(f.amountIn, undefined, true)} → {formatMoney(f.amountOut, undefined, true)}</td>
                    <td className="px-5 py-2.5 text-right text-xs text-slate-400">
                      {f.gapHours === null ? "—" : (
                        <span className={clsx("inline-flex items-center gap-1", f.gapHours >= 0 && f.gapHours <= 24 && "text-sev-high")}>
                          <FiClock /> {f.gapHours < 0 ? "before" : f.gapHours < 48 ? `${f.gapHours}h` : `${Math.round(f.gapHours / 24)}d`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No cross-case flows" description="No account receives funds in one case and sends them in the other." className="!py-8" />
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Combined network" subtitle="Accounts from both cases - shared accounts in pink" icon={<FiShare2 />} />
        <div className="px-3 pb-3 sm:px-5 sm:pb-5">
          <NetworkGraph nodes={c.network.nodes} edges={c.network.edges.map((e) => ({ ...e, flagged: e.cases === "AB" }))} colorMode="membership" height={520} />
        </div>
      </Card>
    </PageContainer>
  );
};

export default CompareResults;
