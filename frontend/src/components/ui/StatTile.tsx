import clsx from "clsx";

export const StatTile = ({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "danger" | "accent";
}) => (
  <div className="card p-4 sm:p-5">
    <div className="flex items-center justify-between">
      <span className="label">{label}</span>
      {icon && <span className="text-slate-500">{icon}</span>}
    </div>
    <div
      className={clsx(
        "mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.7rem]",
        tone === "danger" ? "text-sev-critical" : tone === "accent" ? "text-accent" : "text-white"
      )}
    >
      {value}
    </div>
    {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
  </div>
);
