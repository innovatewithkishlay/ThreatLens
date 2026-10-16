import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../ui/Button";

const KEY = "tl_cookie_notice";

const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return "dismissed";
  }
};

export const CookieBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(!read()), 1200);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      /* storage unavailable */
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="no-print fixed bottom-4 left-4 right-4 z-[90] mx-auto max-w-2xl rounded-2xl border border-white/10 bg-ink-850/95 p-4 shadow-2xl backdrop-blur-xl sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-slate-300">
              🍪 ThreatLens only uses <strong className="text-white">essential cookies</strong> to keep you signed in and your cases private. No tracking or
              advertising.{" "}
              <Link to="/cookie-policy" className="text-accent hover:underline" onClick={dismiss}>
                Learn more
              </Link>
            </p>
            <Button size="sm" onClick={dismiss}>
              Got it
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
