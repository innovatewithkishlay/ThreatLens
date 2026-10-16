import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FiX } from "react-icons/fi";
import clsx from "clsx";

export const Modal = ({
  open,
  onClose,
  title,
  children,
  className,
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: boolean;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={side ? { x: "100%" } : { opacity: 0, y: 24, scale: 0.97 }}
            animate={side ? { x: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={side ? { x: "100%" } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className={clsx(
              "relative z-10 flex flex-col border border-white/10 bg-ink-850 shadow-2xl",
              side ? "ml-auto h-full w-full max-w-lg" : "m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg rounded-2xl",
              className
            )}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
              <div className="min-w-0 font-display text-lg font-semibold text-white">{title}</div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white" aria-label="Close">
                <FiX />
              </button>
            </div>
            <div className="overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
