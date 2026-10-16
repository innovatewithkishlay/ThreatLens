import { useState } from "react";
import clsx from "clsx";
import { toast } from "react-hot-toast";
import { FiCheck, FiPlus, FiTrash2, FiZap } from "react-icons/fi";
import { api } from "../../lib/api";
import type { ChecklistItem } from "../../lib/types";
import { formatDate } from "../../lib/format";

export const Checklist = ({ caseId, items, onChange }: { caseId: string; items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) => {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const done = items.filter((i) => i.done).length;

  const save = async (next: ChecklistItem[]) => {
    const prev = items;
    onChange(next); // optimistic
    setSaving(true);
    try {
      const res = await api.updateCase(caseId, { checklist: next });
      if (res.checklist) onChange(res.checklist);
    } catch (err) {
      onChange(prev);
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
        <span className="font-mono text-xs text-slate-400">{done}/{items.length} done</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={item.key} className="group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]">
            <button
              onClick={() => save(items.map((x, i) => (i === idx ? { ...x, done: !x.done, doneAt: !x.done ? new Date().toISOString() : undefined } : x)))}
              disabled={saving}
              className={clsx(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                item.done ? "border-accent bg-accent text-ink-950" : "border-white/20 hover:border-accent/60"
              )}
              aria-label={item.done ? "Mark as not done" : "Mark as done"}
            >
              {item.done && <FiCheck className="text-xs" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={clsx("text-sm", item.done ? "text-slate-500 line-through" : "text-slate-200")}>{item.text}</p>
              <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-600">
                {item.auto && <span className="inline-flex items-center gap-1"><FiZap /> suggested from findings</span>}
                {item.done && item.doneAt && <span>done {formatDate(item.doneAt, false)}</span>}
              </p>
            </div>
            <button
              onClick={() => save(items.filter((_, i) => i !== idx))}
              className="rounded-lg p-1 text-slate-600 opacity-0 transition hover:text-sev-critical group-hover:opacity-100"
              aria-label="Remove task"
            >
              <FiTrash2 />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          save([...items, { key: `custom-${Date.now()}`, text: text.trim(), done: false, auto: false }]);
          setText("");
        }}
      >
        <input className="input" placeholder="Add a task…" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
        <button type="submit" className="rounded-xl bg-white/[0.06] px-3 text-slate-300 hover:bg-white/[0.1]" aria-label="Add task"><FiPlus /></button>
      </form>
    </div>
  );
};
