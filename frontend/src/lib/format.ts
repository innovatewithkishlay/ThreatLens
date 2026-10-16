import type { CaseStatus, Severity } from "./types";

export const formatMoney = (n: number | undefined | null, currency?: string, compact = false) => {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: currency ? "currency" : "decimal",
      currency: currency || undefined,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;
  }
};

export const formatNumber = (n: number | undefined | null, compact = false) =>
  n === undefined || n === null
    ? "—"
    : new Intl.NumberFormat("en-US", { notation: compact ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);

// Transaction dates are stored as UTC wall-clock time, so render them in UTC.
export const formatDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const formatDate = (d?: string | null, utc = true) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        timeZone: utc ? "UTC" : undefined,
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const timeAgo = (d: string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(d, false);
};

export const SEVERITY: Record<Severity, { label: string; color: string; text: string; bg: string; ring: string }> = {
  critical: { label: "Critical", color: "#ff4d6d", text: "text-sev-critical", bg: "bg-sev-critical/10", ring: "ring-sev-critical/30" },
  high: { label: "High", color: "#ff8a3d", text: "text-sev-high", bg: "bg-sev-high/10", ring: "ring-sev-high/30" },
  medium: { label: "Medium", color: "#facc15", text: "text-sev-medium", bg: "bg-sev-medium/10", ring: "ring-sev-medium/30" },
  low: { label: "Low", color: "#38bdf8", text: "text-sev-low", bg: "bg-sev-low/10", ring: "ring-sev-low/30" },
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export const riskColor = (score: number) =>
  score >= 75 ? SEVERITY.critical.color : score >= 50 ? SEVERITY.high.color : score >= 25 ? SEVERITY.medium.color : "#00ff9d";

export const STATUS: Record<CaseStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-sky-400/10 text-sky-300 ring-sky-400/30" },
  investigating: { label: "Investigating", className: "bg-violet-400/10 text-violet-300 ring-violet-400/30" },
  escalated: { label: "Escalated", className: "bg-sev-critical/10 text-sev-critical ring-sev-critical/30" },
  closed: { label: "Closed", className: "bg-slate-400/10 text-slate-400 ring-slate-400/30" },
};

export const TYPOLOGY_INFO: Record<string, { label: string; help: string }> = {
  highValue: { label: "High-value transfer", help: "Single transfers above the high-value threshold." },
  structuring: { label: "Structuring", help: "Repeated amounts just below the reporting threshold." },
  roundAmounts: { label: "Round amounts", help: "Repeated exact round-number transfers." },
  circular: { label: "Circular flow", help: "Money returns to its origin through intermediaries." },
  passThrough: { label: "Rapid pass-through", help: "Funds received and forwarded almost immediately." },
  fanIn: { label: "Fan-in (smurfing)", help: "Many small deposits converge on one account." },
  fanOut: { label: "Fan-out (dispersion)", help: "One account splits funds across many recipients." },
  frequentPair: { label: "Repeated counterparty", help: "Unusually frequent transfers between two accounts." },
  rapidSuccession: { label: "Transaction burst", help: "Many transfers in a few minutes." },
  unusualTime: { label: "Off-hours activity", help: "Transactions between midnight and 5am." },
  newAccount: { label: "New account, large value", help: "Large transfers soon after an account was opened." },
  highRiskGeo: { label: "High-risk jurisdiction", help: "Activity tied to FATF-monitored jurisdictions." },
  sharedIdentity: { label: "Shared identifiers", help: "Different accounts share email, phone or IP." },
  watchlist: { label: "Watchlist match", help: "Account matches an entry on your watchlist." },
  dormant: { label: "Dormant reactivation", help: "Long-inactive account suddenly moves large sums." },
  outlier: { label: "Out-of-pattern transfer", help: "Transfer far larger than the account's usual behaviour." },
  benford: { label: "Benford's law deviation", help: "Amount distribution suggests fabricated or manipulated values." },
};

export const typologyLabel = (type: string) => TYPOLOGY_INFO[type]?.label || type;

export const MAX_UPLOAD_MB = 10;

export const formatBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;
