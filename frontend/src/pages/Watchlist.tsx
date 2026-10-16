import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import clsx from "clsx";
import { FiAtSign, FiCreditCard, FiEye, FiGlobe, FiPhone, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiUpload, FiUser } from "react-icons/fi";
import { PageContainer, PageHeader } from "../components/layout/AppShell";
import { Card, CardHeader, EmptyState } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { PageLoader } from "../components/ui/Spinner";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";
import type { WatchlistEntry, WatchlistType } from "../lib/types";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const TYPES: { key: WatchlistType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { key: "name", label: "Name", icon: <FiUser />, placeholder: "e.g. Viktor Petrov (fuzzy matched)" },
  { key: "account", label: "Account", icon: <FiCreditCard />, placeholder: "e.g. ACC1015" },
  { key: "email", label: "Email", icon: <FiAtSign />, placeholder: "e.g. mule@example.com" },
  { key: "phone", label: "Phone", icon: <FiPhone />, placeholder: "e.g. +44 7700 900123" },
  { key: "ip", label: "IP address", icon: <FiGlobe />, placeholder: "e.g. 203.0.113.7" },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.key, t]));

// "value, note" per line; a header row or CSV with type,value,note also works.
const parseBulk = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^type\s*,\s*value/i.test(l))
    .map((l) => {
      const parts = l.split(/[,;\t]/).map((p) => p.trim());
      if (["name", "account", "email", "phone", "ip"].includes(parts[0]?.toLowerCase()) && parts[1]) {
        return { type: parts[0].toLowerCase() as WatchlistType, value: parts[1], note: parts.slice(2).join(", ") || undefined };
      }
      return { value: parts[0], note: parts.slice(1).join(", ") || undefined };
    });

const Watchlist = () => {
  useDocumentTitle("Watchlist");
  const [entries, setEntries] = useState<WatchlistEntry[] | null>(null);
  const [type, setType] = useState<WatchlistType>("name");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WatchlistType | "all">("all");
  const [rescreen, setRescreen] = useState<{ done: number; total: number; hits: number } | null>(null);

  const load = () => api.watchlist().then(setEntries).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  const add = async (items: { type?: WatchlistType; value: string; note?: string }[], source?: string) => {
    setAdding(true);
    try {
      const res = await api.addWatchlist(items.map((i) => ({ ...i, source })));
      toast.success(`${res.added} added${res.skipped ? `, ${res.skipped} skipped (duplicate or empty)` : ""}`);
      await load();
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setAdding(false);
    }
  };

  const rescreenAll = async () => {
    const cases = await api.listCases();
    if (!cases.length) return toast("No cases to screen yet.");
    setRescreen({ done: 0, total: cases.length, hits: 0 });
    let hits = 0;
    for (let i = 0; i < cases.length; i++) {
      try {
        const c = await api.reanalyze(cases[i]._id);
        hits += c.analysis.summary.byType.watchlist || 0;
      } catch {
        /* keep going */
      }
      setRescreen({ done: i + 1, total: cases.length, hits });
    }
    toast.success(hits ? `Screening complete: ${hits} watchlist match${hits > 1 ? "es" : ""} found` : "Screening complete: no matches");
    setTimeout(() => setRescreen(null), 4000);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries || []).filter((e) => (filter === "all" || e.type === filter) && (!q || e.value.toLowerCase().includes(q) || e.note?.toLowerCase().includes(q)));
  }, [entries, query, filter]);

  if (!entries) return <PageLoader />;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Screening"
        title="Watchlist"
        description="Accounts, names and identifiers you want flagged automatically. Every new case is screened on upload - names are matched fuzzily, so typos and reordered names still hit."
        actions={
          <>
            <Button variant="secondary" icon={<FiUpload />} onClick={() => setBulkOpen(true)}>Bulk import</Button>
            <Button variant="outline" icon={<FiRefreshCw />} onClick={rescreenAll} loading={!!rescreen && rescreen.done < rescreen.total} disabled={!entries.length}>
              Re-screen all cases
            </Button>
          </>
        }
      />

      {rescreen && (
        <div className="mb-6 rounded-2xl border border-accent/20 bg-accent/[0.04] p-4">
          <div className="flex justify-between text-sm"><span className="text-slate-300">Screening cases…</span><span className="font-mono text-slate-400">{rescreen.done}/{rescreen.total} · {rescreen.hits} matches</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(rescreen.done / rescreen.total) * 100}%` }} /></div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit p-5">
          <h3 className="font-semibold text-white">Add entry</h3>
          <div className="mt-4 grid grid-cols-5 gap-1 rounded-xl bg-ink-900 p-1">
            {TYPES.map((t) => (
              <button key={t.key} onClick={() => setType(t.key)} title={t.label} className={clsx("flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] transition", type === t.key ? "bg-accent text-ink-950" : "text-slate-400 hover:text-white")}>
                {t.icon}
                {t.label.split(" ")[0]}
              </button>
            ))}
          </div>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!value.trim()) return;
              if (await add([{ type, value: value.trim(), note: note.trim() || undefined }], "manual")) {
                setValue("");
                setNote("");
              }
            }}
          >
            <input className="input" placeholder={TYPE[type].placeholder} value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} aria-label="Value" />
            <input className="input" placeholder="Note (optional) - e.g. OFAC SDN, internal blacklist" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Note" />
            <Button type="submit" className="w-full" icon={<FiPlus />} loading={adding} disabled={!value.trim()}>Add to watchlist</Button>
          </form>
        </Card>

        <Card>
          <CardHeader
            title={`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
            icon={<FiEye />}
            action={
              entries.length > 0 && (
                <button
                  className="text-xs text-slate-500 hover:text-sev-critical"
                  onClick={async () => {
                    if (!window.confirm("Remove every watchlist entry?")) return;
                    await api.clearWatchlist();
                    setEntries([]);
                    toast.success("Watchlist cleared");
                  }}
                >
                  Clear all
                </button>
              )
            }
          />
          {entries.length === 0 ? (
            <EmptyState icon={<FiEye />} title="Your watchlist is empty" description="Add sanctioned names, known mule accounts or compromised emails. Matching accounts become critical findings in every case." className="!pt-4" />
          ) : (
            <>
              <div className="flex flex-col gap-2 px-5 pb-4 sm:flex-row">
                <div className="relative flex-1">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input className="input pl-9" placeholder="Search watchlist" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value as WatchlistType | "all")} aria-label="Filter by type">
                  <option value="all">All types</option>
                  {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="divide-y divide-white/[0.04] border-t border-white/[0.06]">
                {visible.slice(0, 300).map((e) => (
                  <div key={e._id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-slate-400" title={TYPE[e.type].label}>{TYPE[e.type].icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm text-white">{e.value}</p>
                      <p className="truncate text-xs text-slate-500">{TYPE[e.type].label}{e.note ? ` · ${e.note}` : ""} · {timeAgo(e.createdAt)}</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await api.removeWatchlist(e._id);
                          setEntries((list) => list?.filter((x) => x._id !== e._id) || null);
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-sev-critical/10 hover:text-sev-critical"
                      aria-label={`Remove ${e.value}`}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
                {!visible.length && <p className="px-5 py-8 text-center text-sm text-slate-500">No entries match.</p>}
              </div>
            </>
          )}
        </Card>
      </div>

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk import">
        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-400">
            One entry per line as <span className="font-mono text-slate-200">value, note</span> - the type is detected automatically. You can also paste a CSV with{" "}
            <span className="font-mono text-slate-200">type,value,note</span> columns.
          </p>
          <textarea rows={10} className="input font-mono text-xs" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Viktor Petrov, OFAC SDN\nACC1015, Known mule\nmule@example.com\n+44 7700 900123, Fraud report #4411"} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-accent hover:underline">
            <FiUpload /> Load from file
            <input type="file" accept=".csv,.txt" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setBulk(await f.text()); e.target.value = ""; }} />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{parseBulk(bulk).length} entries detected</span>
            <Button
              loading={adding}
              disabled={!parseBulk(bulk).length}
              onClick={async () => {
                if (await add(parseBulk(bulk), "import")) {
                  setBulk("");
                  setBulkOpen(false);
                }
              }}
            >
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Watchlist;
