import { LegalPage } from "../components/layout/LegalPage";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const COOKIES = [
  ["jwt", "Keeps you signed in after Google sign-in.", "7 days", "Essential"],
  ["tl_guest", "Anonymous, signed identifier that keeps guest cases private to your browser.", "1 year", "Essential"],
  ["tl_cookie_notice", "Remembers that you dismissed the cookie notice (local storage).", "Until cleared", "Preference"],
];

const CookiePolicy = () => {
  useDocumentTitle("Cookie policy");
  return (
    <LegalPage title="Cookie policy" updated="October 2026">
      <h2>What we use</h2>
      <p>ThreatLens only uses cookies that are strictly necessary for the application to work. There are no analytics, tracking or advertising cookies.</p>
      <div className="not-prose mb-6 overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Purpose</th>
              <th className="px-4 py-2.5">Duration</th>
              <th className="px-4 py-2.5">Type</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map(([n, p, d, t]) => (
              <tr key={n} className="border-t border-white/[0.05]">
                <td className="px-4 py-3 font-mono text-accent">{n}</td>
                <td className="px-4 py-3 text-slate-400">{p}</td>
                <td className="px-4 py-3 text-slate-400">{d}</td>
                <td className="px-4 py-3 text-slate-400">{t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Managing cookies</h2>
      <p>
        You can clear cookies at any time in your browser settings. Clearing <span className="font-mono">tl_guest</span> will disconnect you from cases created
        as a guest - sign in first if you want to keep them.
      </p>
      <h2>Third parties</h2>
      <p>When you choose to sign in, Google handles authentication under its own privacy and cookie policies.</p>
    </LegalPage>
  );
};

export default CookiePolicy;
