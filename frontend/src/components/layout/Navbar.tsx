import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { FiEye, FiFolder, FiGitPullRequest, FiGithub, FiGitMerge, FiKey, FiMenu, FiSearch, FiUploadCloud, FiX } from "react-icons/fi";
import { SearchPalette } from "./SearchPalette";
import { Logo } from "./Logo";
import { useWorkspace } from "../../context/WorkspaceContext";
import { WorkspaceModal } from "./WorkspaceModal";

const LINKS = [
  { to: "/analyze", label: "Analyze", icon: <FiUploadCloud /> },
  { to: "/cases", label: "Cases", icon: <FiFolder /> },
  { to: "/compare", label: "Cross-case", icon: <FiGitMerge /> },
  { to: "/watchlist", label: "Watchlist", icon: <FiEye /> },
];

export const GITHUB_URL = "https://github.com/innovatewithkishlay/ThreatLens";

export const Navbar = () => {
  const { workspace } = useWorkspace();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
      isActive ? "text-accent bg-accent/[0.08]" : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
    );

  return (
    <header
      className={clsx(
        "no-print sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled || mobileOpen ? "border-white/[0.06] bg-ink-950/80 backdrop-blur-xl" : "border-transparent bg-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={navCls}>
                {l.icon}
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm text-slate-500 transition hover:border-accent/40 hover:text-slate-300 lg:w-56"
            aria-label="Search"
          >
            <FiSearch />
            <span className="hidden flex-1 text-left lg:inline">Search entities…</span>
            <kbd className="hidden rounded border border-white/10 px-1.5 font-mono text-[10px] lg:inline">⌘K</kbd>
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white sm:block"
            aria-label="GitHub repository"
          >
            <FiGithub className="text-lg" />
          </a>
          <NavLink to="/contribute" className={({ isActive }) => clsx(navCls({ isActive }), "hidden xl:flex")}>
            <FiGitPullRequest />
            Contribute
          </NavLink>
          <button
            onClick={() => setWorkspaceOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-accent/40 hover:text-white"
            title="Workspace key, sharing and switching"
          >
            <FiKey />
            <span className="hidden sm:inline">Workspace</span>
            {workspace && <span className="hidden font-mono text-slate-600 md:inline">{workspace.key.slice(0, 4)}</span>}
          </button>
          <button className="rounded-lg p-2 text-slate-300 hover:bg-white/[0.06] md:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
            {mobileOpen ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/[0.06] md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              {[...LINKS, { to: "/contribute", label: "Contribute", icon: <FiGitPullRequest /> }].map((l) => (
                <NavLink key={l.to} to={l.to} className={navCls}>
                  {l.icon}
                  {l.label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <WorkspaceModal open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} />
    </header>
  );
};
