import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiGitMerge, FiLink2 } from "react-icons/fi";
import { api } from "../../lib/api";
import type { CaseLink } from "../../lib/types";
import { riskColor } from "../../lib/format";

const KIND: Record<string, string> = { account: "account", email: "email", mobile: "phone", ipAddress: "IP" };

/** "Seen before" alert: entities of this case that appear in other cases. */
export const CaseLinks = ({ caseId, refreshKey }: { caseId: string; refreshKey?: unknown }) => {
  const [links, setLinks] = useState<CaseLink[]>([]);

  useEffect(() => {
    api.links(caseId).then(setLinks).catch(() => setLinks([]));
  }, [caseId, refreshKey]);

  if (!links.length) return null;
  return (
    <div className="mt-4 rounded-2xl border border-cyan-glow/25 bg-cyan-glow/[0.05] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-cyan-glow">
        <FiLink2 /> Seen before - entities in this case appear in {links.length} other case{links.length > 1 ? "s" : ""}
      </p>
      <div className="mt-3 space-y-2">
        {links.slice(0, 4).map((l) => {
          const accounts = [...new Set(l.matches.filter((m) => m.kind === "account").map((m) => m.account))];
          const ids = l.matches.filter((m) => m.kind !== "account");
          return (
            <div key={l.case._id} className="flex flex-col gap-2 rounded-xl bg-ink-900/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <Link to={`/cases/${l.case._id}`} className="font-medium text-white hover:text-accent">{l.case.name}</Link>
                <span className="ml-2 font-mono text-xs" style={{ color: riskColor(l.case.riskScore) }}>risk {l.case.riskScore}</span>
                <div className="mt-0.5 truncate text-xs text-slate-400">
                  {accounts.length > 0 && <>Shared accounts: <span className="font-mono text-slate-200">{accounts.slice(0, 5).join(", ")}</span>{accounts.length > 5 && ` +${accounts.length - 5}`}</>}
                  {accounts.length > 0 && ids.length > 0 && " · "}
                  {ids.length > 0 && <>Shared {[...new Set(ids.map((m) => KIND[m.kind]))].join(", ")}: <span className="font-mono text-slate-200">{ids[0].account} ↔ {ids[0].otherAccount}</span>{ids.length > 1 && ` +${ids.length - 1}`}</>}
                </div>
              </div>
              <Link to={`/compare/${caseId}/${l.case._id}`} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-cyan-glow/10 px-3 py-1.5 text-xs font-semibold text-cyan-glow ring-1 ring-cyan-glow/30 hover:bg-cyan-glow/20 sm:self-auto">
                <FiGitMerge /> Compare
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};
