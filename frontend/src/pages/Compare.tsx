import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { FiArrowRight, FiFolder, FiGitMerge, FiPlay, FiUploadCloud } from "react-icons/fi";
import { PageContainer, PageHeader } from "../components/layout/AppShell";
import { Card, EmptyState } from "../components/ui/Card";
import { Button, LinkButton } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { SeverityBadge } from "../components/ui/Badge";
import { PageLoader } from "../components/ui/Spinner";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { CsvDropzone, FileChip } from "../components/upload/CsvDropzone";
import { api, type ApiError } from "../lib/api";
import { formatNumber, riskColor, timeAgo } from "../lib/format";
import type { CaseSummary } from "../lib/types";
import { useDemoCase } from "../hooks/useDemoCase";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const Slot = ({ label, c, color }: { label: string; c?: CaseSummary; color: string }) => (
  <div className={clsx("flex-1 rounded-2xl border-2 border-dashed p-4 transition", c ? "border-solid" : "border-white/10")} style={c ? { borderColor: `${color}66`, background: `${color}0d` } : undefined}>
    <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</div>
    {c ? (
      <>
        <div className="mt-1 truncate font-semibold text-white">{c.name}</div>
        <div className="font-mono text-xs text-slate-500">{c.caseId}</div>
      </>
    ) : (
      <div className="mt-1 text-sm text-slate-500">Select a case below</div>
    )}
  </div>
);

const Compare = () => {
  useDocumentTitle("Cross-case analysis");
  const navigate = useNavigate();
  const demo = useDemoCase();
  const [mode, setMode] = useState("existing");
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [files, setFiles] = useState<(File | null)[]>([null, null]);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<ApiError | null>(null);

  useEffect(() => {
    api.listCases().then((c) => {
      setCases(c);
      if (c.length < 2) setMode("upload");
    }).catch(setError);
  }, []);

  const pick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 2 ? [p[1], id] : [...p, id]));

  const uploadPair = async () => {
    if (!files[0] || !files[1]) return;
    setUploadError(null);
    setProgress(0);
    try {
      const res = await api.uploadPair([files[0], files[1]], setProgress);
      navigate(`/compare/${res.caseA}/${res.caseB}`);
    } catch (err) {
      setUploadError(err as ApiError);
      setProgress(null);
    }
  };

  if (error) return <PageContainer><ErrorPanel error={error} /></PageContainer>;
  if (!cases) return <PageLoader />;

  const byId = new Map(cases.map((c) => [c._id, c]));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Cross-case intelligence"
        title="Link two investigations"
        description="Find shared accounts and identifiers, money flowing between cases, overlapping activity and matching typologies."
        actions={<Button variant="secondary" icon={<FiPlay />} onClick={demo.runPair} loading={demo.loading === "pair"}>Run linked-case demo</Button>}
      />

      <Tabs
        tabs={[
          { key: "existing", label: "From my cases", icon: <FiFolder />, count: cases.length },
          { key: "upload", label: "Upload two files", icon: <FiUploadCloud /> },
        ]}
        active={mode}
        onChange={setMode}
        layoutId="compare-mode"
      />

      <div className="mt-6">
        {mode === "existing" ? (
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Slot label="Case A" c={byId.get(picked[0])} color="#00ff9d" />
              <FiGitMerge className="mx-auto shrink-0 rotate-90 text-2xl text-slate-600 sm:rotate-0" />
              <Slot label="Case B" c={byId.get(picked[1])} color="#22d3ee" />
              <Button className="sm:ml-2" disabled={picked.length !== 2} icon={<FiArrowRight />} onClick={() => navigate(`/compare/${picked[0]}/${picked[1]}`)}>
                Compare
              </Button>
            </div>

            {cases.length < 2 ? (
              <EmptyState
                className="mt-4"
                icon={<FiFolder />}
                title="You need at least two cases"
                description="Analyse more datasets or upload two files directly."
                action={<LinkButton to="/analyze">Analyze a case</LinkButton>}
              />
            ) : (
              <div className="mt-6 grid gap-2 md:grid-cols-2">
                {cases.map((c) => {
                  const idx = picked.indexOf(c._id);
                  return (
                    <button
                      key={c._id}
                      onClick={() => pick(c._id)}
                      className={clsx(
                        "flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition",
                        idx === 0 ? "border-accent/60 bg-accent/[0.06]" : idx === 1 ? "border-cyan-glow/60 bg-cyan-glow/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
                      )}
                    >
                      <span className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold", idx === 0 ? "bg-accent text-ink-950" : idx === 1 ? "bg-cyan-glow text-ink-950" : "bg-white/[0.06] text-slate-500")}>
                        {idx === 0 ? "A" : idx === 1 ? "B" : ""}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-white">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.caseId} · {formatNumber(c.stats.transactionCount)} transfers · {timeAgo(c.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold tabular-nums" style={{ color: riskColor(c.riskScore) }}>{c.riskScore}</span>
                        <SeverityBadge level={c.riskLevel} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-5 sm:p-6">
            <div className="grid gap-5 md:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: i ? "#22d3ee" : "#00ff9d" }}>Case {i ? "B" : "A"}</p>
                  {files[i] ? (
                    <FileChip file={files[i]!} disabled={progress !== null} onRemove={() => setFiles((f) => f.map((x, j) => (j === i ? null : x)))} />
                  ) : (
                    <CsvDropzone compact label={`Drop CSV for case ${i ? "B" : "A"}`} onFile={(file) => setFiles((f) => f.map((x, j) => (j === i ? file : x)))} />
                  )}
                </div>
              ))}
            </div>
            {uploadError && <div className="mt-5"><ErrorPanel error={uploadError} title="Upload failed" /></div>}
            {progress !== null && (
              <div className="mt-5">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress < 100 ? progress * 0.7 : 90}%` }} />
                </div>
                <p className="mt-2 text-center text-xs text-slate-500">{progress < 100 ? `Uploading… ${progress}%` : "Analysing both cases and computing links…"}</p>
              </div>
            )}
            <Button className="mt-5 w-full" disabled={!files[0] || !files[1]} loading={progress !== null} icon={<FiGitMerge />} onClick={uploadPair}>
              Analyse & compare
            </Button>
          </Card>
        )}
      </div>
    </PageContainer>
  );
};

export default Compare;
