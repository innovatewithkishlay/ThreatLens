import { FiArrowLeft, FiSearch } from "react-icons/fi";
import { motion } from "framer-motion";
import { LinkButton } from "../components/ui/Button";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const NotFound = () => {
  useDocumentTitle("Page not found");
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative">
        <div className="font-display text-[120px] font-bold leading-none text-white/[0.04] sm:text-[180px]">404</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-3xl text-accent shadow-glow">
            <FiSearch />
          </div>
        </div>
      </motion.div>
      <h1 className="mt-4 font-display text-3xl font-bold text-white">Trail went cold</h1>
      <p className="mt-3 text-slate-400">The page you're looking for doesn't exist or has been moved.</p>
      <div className="mt-8 flex gap-3">
        <LinkButton to="/" icon={<FiArrowLeft />}>Back home</LinkButton>
        <LinkButton to="/cases" variant="secondary">My cases</LinkButton>
      </div>
    </div>
  );
};

export default NotFound;
