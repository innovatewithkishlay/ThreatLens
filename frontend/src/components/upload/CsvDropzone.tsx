import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { motion } from "framer-motion";
import clsx from "clsx";
import { FiFileText, FiUploadCloud, FiX } from "react-icons/fi";
import { toast } from "react-hot-toast";

import { formatBytes, MAX_UPLOAD_MB as MAX_MB } from "../../lib/format";

export const CsvDropzone = ({
  onFile,
  disabled,
  compact,
  label = "Drop your transaction CSV here",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
}) => {
  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length) {
        const code = rejected[0].errors[0]?.code;
        toast.error(code === "file-too-large" ? `File is larger than ${MAX_MB} MB.` : "Only .csv files are supported.");
        return;
      }
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled,
    maxSize: MAX_MB * 1024 * 1024,
    accept: { "text/csv": [".csv"], "application/vnd.ms-excel": [".csv"] },
  });

  return (
    <div
      {...getRootProps()}
      className={clsx(
        "group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed text-center transition-all duration-300",
        compact ? "px-4 py-8" : "px-6 py-14",
        isDragActive ? "border-accent bg-accent/[0.08] shadow-glow" : "border-white/10 bg-ink-900/60 hover:border-accent/50 hover:bg-accent/[0.03]",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <input {...getInputProps()} />
      {isDragActive && <div className="absolute inset-x-0 top-0 h-1/2 animate-scan bg-gradient-to-b from-transparent via-accent/10 to-transparent" />}
      <motion.div
        animate={isDragActive ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
        className={clsx(
          "mx-auto flex items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/25 transition group-hover:bg-accent/15",
          compact ? "h-12 w-12 text-2xl" : "h-16 w-16 text-3xl"
        )}
      >
        <FiUploadCloud />
      </motion.div>
      <p className={clsx("mt-4 font-semibold text-white", compact ? "text-sm" : "text-base")}>{isDragActive ? "Release to upload" : label}</p>
      <p className="mt-1 text-sm text-slate-500">
        or <span className="text-accent underline-offset-4 group-hover:underline">browse files</span> · CSV up to {MAX_MB} MB
      </p>
    </div>
  );
};

export const FileChip = ({ file, onRemove, disabled }: { file: File; onRemove?: () => void; disabled?: boolean }) => (
  <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-ink-900/80 px-3.5 py-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
      <FiFileText />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-white">{file.name}</p>
      <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
    </div>
    {onRemove && (
      <button onClick={onRemove} disabled={disabled} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40" aria-label="Remove file">
        <FiX />
      </button>
    )}
  </div>
);
