import { FiAlertTriangle } from "react-icons/fi";
import type { ApiError } from "../../lib/api";

export const ErrorPanel = ({ error, title = "Something went wrong" }: { error: ApiError | Error; title?: string }) => {
  const details = (error as ApiError).details || [];
  const found = (error as ApiError).found;
  return (
    <div className="rounded-2xl border border-sev-critical/30 bg-sev-critical/[0.06] p-4">
      <div className="flex items-start gap-3">
        <FiAlertTriangle className="mt-0.5 shrink-0 text-lg text-sev-critical" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-slate-300">{error.message}</p>
          {details.length > 0 && (
            <ul className="mt-2 space-y-1 text-slate-400">
              {details.map((d, i) => (
                <li key={i} className="font-mono text-xs">• {d}</li>
              ))}
            </ul>
          )}
          {found && found.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Columns found: <span className="font-mono text-slate-400">{found.join(", ")}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
