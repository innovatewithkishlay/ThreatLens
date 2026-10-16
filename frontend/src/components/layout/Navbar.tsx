import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { FiChevronDown, FiFolder, FiGitPullRequest, FiGithub, FiGitMerge, FiLogOut, FiMenu, FiUploadCloud, FiUser, FiX } from "react-icons/fi";
import { Logo } from "./Logo";
import { useAuth } from "../../context/AuthContext";
import { useClickOutside } from "../../hooks/useClickOutside";
import { Button } from "../ui/Button";

const LINKS = [
  { to: "/analyze", label: "Analyze", icon: <FiUploadCloud /> },
  { to: "/cases", label: "Cases", icon: <FiFolder /> },
  { to: "/compare", label: "Cross-case", icon: <FiGitMerge /> },
];

export const GITHUB_URL = "https://github.com/innovatewithkishlay/ThreatLens";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

const UserMenu = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-1 pl-1 pr-2.5 transition hover:border-accent/40"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-lg object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <FiUser />
          </span>
        )}
        <span className="hidden max-w-[120px] truncate text-sm text-slate-200 md:block">{user.name.split(" ")[0]}</span>
        <FiChevronDown className={clsx("text-slate-500 transition", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-ink-850/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="border-b border-white/[0.06] px-4 py-3">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
            <NavLink to="/cases" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]">
              <FiFolder /> My cases
            </NavLink>
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-sev-critical hover:bg-sev-critical/10"
            >
              <FiLogOut /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const Navbar = () => {
  const { user, loading, googleEnabled, signIn } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

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
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white sm:block"
            aria-label="GitHub repository"
          >
            <FiGithub className="text-lg" />
          </a>
          <NavLink to="/contribute" className={({ isActive }) => clsx(navCls({ isActive }), "hidden lg:flex")}>
            <FiGitPullRequest />
            Contribute
          </NavLink>
          {!loading &&
            (user ? (
              <UserMenu />
            ) : googleEnabled ? (
              <Button variant="secondary" size="sm" onClick={signIn} icon={<GoogleIcon />} className="py-2">
                Sign in
              </Button>
            ) : (
              <span
                className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 sm:flex"
                title="Your cases are private to this browser."
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Guest workspace
              </span>
            ))}
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
    </header>
  );
};
