import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { FiArrowLeft, FiCopy, FiEdit3, FiEye, FiPrinter, FiRefreshCw, FiSave } from "react-icons/fi";
import { PageContainer } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { PageLoader } from "../components/ui/Spinner";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { api, type ApiError } from "../lib/api";
import { formatDate, formatMoney, SEVERITY, STATUS } from "../lib/format";
import type { CaseReport as Report } from "../lib/types";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const CaseReport = () => {
  const { id = "" } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useDocumentTitle(report ? `SAR draft - ${report.name}` : "Report");

  useEffect(() => {
    api
      .report(id)
      .then((r) => {
        setReport(r);
        setText(r.draft || r.narrative);
        setSaved(r.draft || r.narrative);
      })
      .catch(setError);
  }, [id]);

  if (error) return <PageContainer><ErrorPanel error={error} title="Could not build report" /></PageContainer>;
  if (!report) return <PageLoader label="Drafting report" />;

  const save = async () => {
    setSaving(true);
    try {
      await api.updateCase(id, { reportDraft: text });
      setSaved(text);
      toast.success("Draft saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const cur = report.totals.currency;
  const sev = SEVERITY[report.riskLevel];
  const dirty = text !== saved;

  return (
    <PageContainer className="!pt-6">
      <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link to={`/cases/${id}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><FiArrowLeft /> Back to case</Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={editing ? <FiEye /> : <FiEdit3 />} onClick={() => setEditing((v) => !v)}>{editing ? "Preview" : "Edit narrative"}</Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FiRefreshCw />}
            onClick={() => {
              if (text !== report.narrative && !window.confirm("Replace the current narrative with a freshly generated draft?")) return;
              setText(report.narrative);
              setEditing(true);
            }}
          >
            Regenerate
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FiCopy />}
            onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Narrative copied"), () => toast.error("Clipboard unavailable"))}
          >
            Copy
          </Button>
          <Button variant="secondary" size="sm" icon={<FiSave />} loading={saving} disabled={!dirty} onClick={save}>{dirty ? "Save draft" : "Saved"}</Button>
          <Button size="sm" icon={<FiPrinter />} onClick={() => window.print()}>Print / PDF</Button>
        </div>
      </div>

      <div className="no-print mb-4 rounded-xl border border-sev-medium/25 bg-sev-medium/[0.05] px-4 py-3 text-xs text-slate-300">
        This is an automatically generated <strong>draft</strong> to accelerate your Suspicious Activity Report. Review every statement against the evidence before filing.
      </div>

      <article className="print-area mx-auto max-w-4xl rounded-2xl bg-white px-6 py-8 text-slate-800 shadow-2xl sm:px-12 sm:py-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Suspicious Activity Report - Draft</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">{report.name}</h1>
            <p className="mt-1 font-mono text-xs text-slate-500">{report.caseId}</p>
          </div>
          <div className="text-left sm:text-right">
            <div className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5" style={{ borderColor: sev.color, color: sev.color }}>
              <span className="font-display text-2xl font-bold">{report.riskScore}</span>
              <span className="text-xs font-bold uppercase">{sev.label} risk</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Prepared {formatDate(report.generatedAt, false)}</p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {[
            ["Activity period", report.period ? `${formatDate(report.period.start)} – ${formatDate(report.period.end)}` : "Unknown"],
            ["Transfers reviewed", report.totals.transactions?.toLocaleString()],
            ["Total volume", formatMoney(report.totals.volume, cur)],
            ["Case status", STATUS[report.status]?.label],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k}</p>
              <p className="mt-0.5 font-medium text-slate-900">{v}</p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Subjects</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-1.5 pr-3">Account</th>
                  <th className="py-1.5 pr-3">Holder / identifiers</th>
                  <th className="py-1.5 pr-3 text-right">In / Out</th>
                  <th className="py-1.5 text-right">Risk</th>
                </tr>
              </thead>
              <tbody>
                {report.subjects.map((s) => (
                  <tr key={s.account} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-3 font-mono text-xs font-semibold text-slate-900">{s.account}</td>
                    <td className="py-2 pr-3">
                      <div className="text-slate-900">{s.holder}{s.country ? ` (${s.country})` : ""}</div>
                      <div className="text-xs text-slate-500">{[s.email, s.phone, s.ip].filter(Boolean).join(" · ")}</div>
                      {s.reasons.length > 0 && <div className="mt-0.5 text-xs text-slate-500">{s.reasons.join(", ")}</div>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-right font-mono text-xs">{formatMoney(s.inflow, cur, true)} / {formatMoney(s.outflow, cur, true)}</td>
                    <td className="py-2 text-right font-bold" style={{ color: s.score >= 75 ? SEVERITY.critical.color : s.score >= 50 ? SEVERITY.high.color : "#334155" }}>{s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Narrative</h2>
          {editing ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={28}
              className="no-print mt-3 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-4 font-mono text-[13px] leading-relaxed text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          ) : null}
          <div className={editing ? "hidden print:block" : ""}>
            {text.split(/\n{2,}/).map((block, i) => {
              const [first, ...rest] = block.split("\n");
              const isHeading = first === first.toUpperCase() && /[A-Z]/.test(first) && first.length < 60;
              return (
                <div key={i} className="mt-4">
                  {isHeading ? (
                    <>
                      <h3 className="text-sm font-bold text-slate-900">{first.charAt(0) + first.slice(1).toLowerCase()}</h3>
                      <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-slate-700">{rest.join("\n")}</p>
                    </>
                  ) : (
                    <p className="whitespace-pre-line text-[14px] leading-relaxed text-slate-700">{block}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {report.notes && (
          <section className="mt-8">
            <h2 className="border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Investigator notes</h2>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-slate-700">{report.notes}</p>
          </section>
        )}

        <footer className="mt-12 grid grid-cols-2 gap-10 border-t border-slate-200 pt-8 text-xs text-slate-500">
          <div><div className="h-8 border-b border-slate-300" /><p className="mt-1.5">Prepared by</p></div>
          <div><div className="h-8 border-b border-slate-300" /><p className="mt-1.5">Reviewed / approved by (MLRO)</p></div>
        </footer>
      </article>
    </PageContainer>
  );
};

export default CaseReport;
