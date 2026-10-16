import clsx from "clsx";
import { SEVERITY, STATUS } from "../../lib/format";
import type { CaseStatus, Severity } from "../../lib/types";

export const Badge = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", className)}>
    {children}
  </span>
);

export const SeverityBadge = ({ level, className }: { level: Severity; className?: string }) => {
  const s = SEVERITY[level] || SEVERITY.low;
  return (
    <Badge className={clsx(s.bg, s.text, s.ring, className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </Badge>
  );
};

export const StatusBadge = ({ status }: { status: CaseStatus }) => {
  const s = STATUS[status] || STATUS.open;
  return <Badge className={s.className}>{s.label}</Badge>;
};
