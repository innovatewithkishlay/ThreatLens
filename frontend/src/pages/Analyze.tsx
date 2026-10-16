import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { FiArrowRight, FiCheckCircle, FiDownload, FiInfo, FiPlay } from "react-icons/fi";
import { PageContainer, PageHeader } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Button, LinkButton } from "../components/ui/Button";
import { CsvDropzone, FileChip } from "../components/upload/CsvDropzone";
import { ColumnCheck } from "../components/upload/ColumnCheck";
import { ErrorPanel } from "../components/ui/ErrorPanel";
import { previewCsv, type CsvPreview } from "../lib/csvPreview";
import { api, type ApiError } from "../lib/api";
import { SAMPLE_A, useDemoCase } from "../hooks/useDemoCase";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const STAGES = ["Uploading file", "Parsing & validating rows", "Running 13 detectors", "Scoring accounts & building network"];

const Analyze = () => {
  useDocumentTitle("Analyze");
  const navigate = useNavigate();
  const demo = useDemoCase();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [name, setName] = useState("");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState<ApiError | null>(null);

  const busy = stage >= 0;

  const choose = async (f: File) => {
    setError(null);
    setFile(f);
    setName(f.name.replace(/\.csv$/i, "").replace(/[_-]+/g, " "));
    try {
      setPreview(await previewCsv(f));
    } catch {
      setPreview(null);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setProgress(0);
    setStage(-1);
  };

  const submit = async () => {
    if (!file) return;
    setError(null);
    setStage(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const res = await api.uploadCase(file, {
        name: name.trim() || undefined,
        onProgress: (p) => {
          setProgress(p);
          if (p >= 100 && !timer) {
            setStage(1);
            timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 700);
          }
        },
      });
      clearInterval(timer);
      setStage(STAGES.length);
      res.warnings.slice(0, 2).forEach((w) => toast(w, { icon: "⚠️", duration: 6000 }));
      toast.success(`Case ${res.caseId} created`);
      navigate(`/cases/${res.id}`);
    } catch (err) {
      clearInterval(timer);
      setError(err as ApiError);
      setStage(-1);
      setProgress(0);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="New investigation"
        title="Analyze transactions"
        description="Upload a CSV export of transfers. ThreatLens validates every row, runs the detection engine and opens a full case workspace."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-5 sm:p-6">
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CsvDropzone onFile={choose} />
                <div className="mt-5 flex flex-col items-center justify-center gap-3 text-sm text-slate-500 sm:flex-row">
                  <span>No data handy?</span>
                  <Button variant="outline" size="sm" icon={<FiPlay />} onClick={demo.runSingle} loading={demo.loading === "single"}>
                    Analyze the demo dataset
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="file" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                <FileChip file={file} onRemove={reset} disabled={busy} />

                <div>
                  <label htmlFor="case-name" className="label mb-2 block">
                    Case name
                  </label>
                  <input id="case-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} disabled={busy} placeholder="e.g. Q2 suspicious wires" />
                </div>

                {preview && (
                  <div>
                    <p className="label mb-2">Detected columns</p>
                    <ColumnCheck preview={preview} />
                  </div>
                )}

                {error && <ErrorPanel error={error} title="We couldn't analyse this file" />}

                {busy ? (
                  <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full bg-accent"
                        animate={{ width: `${stage === 0 ? progress * 0.4 : 40 + ((stage) / STAGES.length) * 60}%` }}
                        transition={{ ease: "easeOut" }}
                      />
                    </div>
                    <ul className="mt-4 space-y-2">
                      {STAGES.map((s, i) => (
                        <li key={s} className={`flex items-center gap-2.5 text-sm ${i < stage ? "text-accent" : i === stage ? "text-white" : "text-slate-600"}`}>
                          {i < stage ? <FiCheckCircle /> : <span className={`h-2 w-2 rounded-full ${i === stage ? "animate-pulse bg-accent" : "bg-slate-700"} mx-[3px]`} />}
                          {s}
                          {i === 0 && stage === 0 && <span className="ml-auto font-mono text-xs text-slate-500">{progress}%</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button variant="secondary" onClick={reset} className="sm:w-40">
                      Choose another
                    </Button>
                    <Button onClick={submit} disabled={!!preview?.missingRequired.length} icon={<FiArrowRight />} className="flex-1">
                      {preview?.missingRequired.length ? "Required columns missing" : "Run analysis"}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <FiInfo className="text-accent" /> File format
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              One row per transfer. Only three columns are required - the rest unlock more detections.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                ["fromAccount", "Sender account", true],
                ["toAccount", "Receiver account", true],
                ["amount", "Positive number, e.g. 9500 or $9,500.00", true],
                ["date", "ISO 8601 (2025-06-01T09:30:00) or DD/MM/YYYY", false],
                ["country", "ISO code of origin, e.g. GB, NG", false],
                ["email / mobile / ipAddress", "Account identifiers", false],
                ["accountOpened", "Date the sender account was opened", false],
              ].map(([col, desc, req]) => (
                <li key={col as string} className="flex gap-2">
                  <code className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs ${req ? "bg-accent/10 text-accent" : "bg-white/[0.05] text-slate-300"}`}>{col}</code>
                  <span className="text-slate-500">{desc}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              Column names are matched flexibly - <span className="font-mono">Sender</span>, <span className="font-mono">Beneficiary</span>,{" "}
              <span className="font-mono">Timestamp</span> and similar headers work too. Comma, semicolon and tab separators are supported.
            </p>
            <LinkButton to={SAMPLE_A} download="threatlens-sample.csv" variant="secondary" size="sm" icon={<FiDownload />} className="mt-5 w-full">
              Download sample CSV
            </LinkButton>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-white">Privacy</h3>
            <p className="mt-2 text-sm text-slate-400">
              Files are processed in memory and never stored on disk. Cases are visible only to you and can be deleted at any time.
            </p>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};

export default Analyze;
