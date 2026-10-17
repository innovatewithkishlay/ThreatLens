import { Link } from "react-router-dom";
import { FiGithub, FiMail } from "react-icons/fi";
import { Logo } from "./Logo";
import { GITHUB_URL } from "./Navbar";

export const Footer = () => (
  <footer className="no-print relative z-10 mt-24 border-t border-white/[0.06] bg-ink-950/60 backdrop-blur">
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8">
      <div>
        <Logo />
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
          Open-source anti-money-laundering investigation platform. Detect typologies, map networks and link cases - in minutes.
        </p>
      </div>
      <div>
        <h4 className="label mb-3">Product</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li><Link className="hover:text-accent" to="/analyze">Analyze a case</Link></li>
          <li><Link className="hover:text-accent" to="/cases">Case workspace</Link></li>
          <li><Link className="hover:text-accent" to="/compare">Cross-case analysis</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="label mb-3">Project</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li><Link className="hover:text-accent" to="/contribute">Contribute</Link></li>
          <li><a className="inline-flex items-center gap-1.5 hover:text-accent" href={GITHUB_URL} target="_blank" rel="noreferrer"><FiGithub /> GitHub</a></li>
          <li><a className="inline-flex items-center gap-1.5 hover:text-accent" href="mailto:kishlay141@gmail.com"><FiMail /> Contact</a></li>
        </ul>
      </div>
      <div>
        <h4 className="label mb-3">Legal</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li><Link className="hover:text-accent" to="/privacy-policy">Privacy policy</Link></li>
          <li><Link className="hover:text-accent" to="/cookie-policy">Cookie policy</Link></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-white/[0.04]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-600 sm:flex-row sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} ThreatLens. Released under the MIT License.</p>
        <p className="font-mono">Built for investigators, by the open-source community · build {__BUILD__}</p>
      </div>
    </div>
  </footer>
);
