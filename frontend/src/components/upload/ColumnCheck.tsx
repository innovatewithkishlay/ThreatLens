import clsx from "clsx";
import { FiAlertCircle, FiCheck, FiMinus } from "react-icons/fi";
import { FIELD_LABELS, type CsvPreview } from "../../lib/csvPreview";

export const ColumnCheck = ({ preview }: { preview: CsvPreview }) => (
  <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-2">
      {Object.entries(FIELD_LABELS).map(([field, info]) => {
        const col = preview.mapping[field];
        const missingRequired = !col && info.required;
        return (
          <div
            key={field}
            className={clsx(
              "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
              col ? "border-accent/20 bg-accent/[0.04]" : missingRequired ? "border-sev-critical/40 bg-sev-critical/[0.06]" : "border-white/[0.06] bg-white/[0.02]"
            )}
          >
            <span
              className={clsx(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs",
                col ? "bg-accent text-ink-950" : missingRequired ? "bg-sev-critical text-white" : "bg-white/10 text-slate-500"
              )}
            >
              {col ? <FiCheck /> : missingRequired ? <FiAlertCircle /> : <FiMinus />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200">
                {info.label}
                {info.required && <span className="ml-1 text-sev-critical">*</span>}
              </p>
              <p className="truncate text-xs text-slate-500">{col ? <span className="font-mono text-accent/80">{col}</span> : info.unlocks}</p>
            </div>
          </div>
        );
      })}
    </div>

    {preview.rows.length > 0 && (
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <span className="label">Preview</span>
          <span className="text-xs text-slate-500">≈ {preview.rowCount.toLocaleString()} rows · {preview.headers.length} columns</span>
        </div>
        <div className="max-h-56 overflow-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-ink-850">
              <tr>
                {preview.headers.map((h, i) => (
                  <th key={i} className={clsx("whitespace-nowrap px-3 py-2 font-medium", Object.values(preview.mapping).includes(h) ? "text-accent" : "text-slate-500")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r, i) => (
                <tr key={i} className="border-t border-white/[0.04]">
                  {preview.headers.map((_, j) => (
                    <td key={j} className="max-w-[180px] truncate whitespace-nowrap px-3 py-1.5 text-slate-400">
                      {r[j]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);
