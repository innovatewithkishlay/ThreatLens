import { motion, type Variants } from "framer-motion";
import {
  FiActivity,
  FiArrowRight,
  FiClock,
  FiCpu,
  FiCrosshair,
  FiEye,
  FiFileText,
  FiSearch,
  FiDownload,
  FiGitMerge,
  FiGlobe,
  FiLock,
  FiPlay,
  FiRepeat,
  FiShare2,
  FiShield,
  FiUploadCloud,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import { HeroGraph } from "../components/viz/HeroGraph";
import { Button, LinkButton } from "../components/ui/Button";
import { useDemoCase } from "../hooks/useDemoCase";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { GITHUB_URL } from "../components/layout/Navbar";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } }),
};

const TYPOLOGIES = [
  { icon: <FiRepeat />, title: "Circular flows", text: "Chronological loops where money returns to its origin through intermediaries." },
  { icon: <FiZap />, title: "Structuring", text: "Repeated transfers just under the reporting threshold." },
  { icon: <FiShare2 />, title: "Fan-in / fan-out", text: "Smurfing deposits and rapid dispersion across many accounts." },
  { icon: <FiActivity />, title: "Pass-through mules", text: "Funds received and forwarded within minutes." },
  { icon: <FiUsers />, title: "Shared identities", text: "Distinct accounts sharing an email, phone or IP address." },
  { icon: <FiGlobe />, title: "High-risk jurisdictions", text: "Exposure to FATF-monitored countries, mapped worldwide." },
  { icon: <FiClock />, title: "Behavioural anomalies", text: "Dormant accounts waking up, out-of-pattern transfers, bursts and off-hours activity." },
  { icon: <FiShield />, title: "Benford's law forensics", text: "Statistical first-digit test that exposes fabricated or manipulated amounts." },
];

const STEPS = [
  { icon: <FiUploadCloud />, title: "Upload a CSV", text: "Drop any transaction export. Column names are detected automatically - sender, beneficiary, amount, date and more." },
  { icon: <FiCpu />, title: "17 detectors run", text: "Every transfer is scored against proven AML typologies. Accounts get explainable risk scores." },
  { icon: <FiActivity />, title: "Investigate", text: "Explore the money network, timeline and world map. Review transactions and record case notes." },
  { icon: <FiDownload />, title: "Report", text: "Export flagged transactions as CSV, the full analysis as JSON, or print a case report." },
];

const Home = () => {
  useDocumentTitle();
  const demo = useDemoCase();

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:pt-24">
        <div>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0} className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/[0.06] px-3 py-1 text-xs font-medium text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Open-source AML investigation platform
          </motion.div>
          <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={1} className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Follow the money.
            <br />
            <span className="text-gradient">Expose the pattern.</span>
          </motion.h1>
          <motion.p variants={fadeUp} initial="hidden" animate="show" custom={2} className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            ThreatLens turns raw transaction exports into an investigation workspace - detecting layering, structuring, mule networks and shared identities, then
            linking related cases together.
          </motion.p>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <LinkButton to="/analyze" size="lg" icon={<FiUploadCloud />}>
              Analyze transactions
            </LinkButton>
            <Button variant="secondary" size="lg" icon={<FiPlay />} onClick={demo.runSingle} loading={demo.loading === "single"}>
              Try the live demo
            </Button>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            <span className="flex items-center gap-2"><FiLock className="text-accent" /> Cases private to you</span>
            <span className="flex items-center gap-2"><FiZap className="text-accent" /> Results in seconds</span>
            <span className="flex items-center gap-2"><FiShield className="text-accent" /> MIT licensed</span>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
          <HeroGraph />
        </motion.div>
      </section>

      {/* Metrics strip */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="card grid grid-cols-2 divide-white/[0.06] md:grid-cols-4 md:divide-x">
          {[
            ["17", "Detection typologies"],
            ["25k", "Transactions per case"],
            ["< 5s", "Typical analysis time"],
            ["100%", "Explainable scores"],
          ].map(([v, l]) => (
            <div key={l} className="px-6 py-6 text-center">
              <div className="font-display text-3xl font-bold text-white">{v}</div>
              <div className="mt-1 text-sm text-slate-500">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Typologies */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Detection engine</div>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">Built on real money-laundering typologies</h2>
          <p className="mt-4 text-slate-400">Every finding explains what was found, why it matters and exactly which transactions are involved.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TYPOLOGIES.map((t, i) => (
            <motion.div
              key={t.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              custom={i % 4}
              className="card card-hover group p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent ring-1 ring-accent/20 transition group-hover:bg-accent group-hover:text-ink-950">
                {t.icon}
              </div>
              <h3 className="mt-4 font-semibold text-white">{t.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Workflow</div>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">From spreadsheet to findings in four steps</h2>
        </div>
        <div className="relative mt-12 grid gap-6 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent md:block" />
          {STEPS.map((s, i) => (
            <motion.div key={s.title} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} className="relative text-center">
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-ink-900 text-xl text-accent shadow-glow">
                {s.icon}
                <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent font-mono text-xs font-bold text-ink-950">{i + 1}</span>
              </div>
              <h3 className="mt-5 font-semibold text-white">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Investigator toolkit */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Investigator toolkit</div>
          <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">Solves the slow parts of every investigation</h2>
          <p className="mt-4 text-slate-400">The work that usually takes days of spreadsheets now takes minutes.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {[
            { icon: <FiCrosshair />, title: "Trace funds hop by hop", text: "Pick any account and see exactly where its money ended up - or where incoming money came from - across up to 10 hops, replayed in time order.", tag: "Follow the money" },
            { icon: <FiFileText />, title: "Draft the SAR in one click", text: "A structured who / what / when / where / why / how narrative is generated from the evidence. Edit it, save it, print it to PDF.", tag: "Hours → minutes" },
            { icon: <FiEye />, title: "Watchlist screening", text: "Screen every case against your own list of names, accounts, emails, phones and IPs. Fuzzy name matching catches typos and reordered names.", tag: "Sanctions & blacklists" },
            { icon: <FiSearch />, title: "Have we seen this before?", text: "Search any entity across all cases with ⌘K. Each case automatically alerts you when its accounts or identifiers appear in other investigations.", tag: "Institutional memory" },
          ].map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i % 2} className="card card-hover flex gap-5 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-xl text-accent ring-1 ring-accent/20">{f.icon}</div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-400">{f.tag}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Cross-case */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
        <div className="card relative overflow-hidden p-8 sm:p-12">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-glow/10 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-glow/30 bg-cyan-glow/10 px-3 py-1 text-xs font-semibold text-cyan-glow">
                <FiGitMerge /> Cross-case intelligence
              </div>
              <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">Connect cases other tools keep apart</h2>
              <p className="mt-4 text-slate-400">
                Compare any two investigations to uncover shared mule accounts, common emails, phones and IPs, money that flows from one case into the other,
                overlapping activity windows and matching typologies - summarised as a single link score.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LinkButton to="/compare" variant="outline" icon={<FiGitMerge />}>
                  Compare cases
                </LinkButton>
                <Button variant="ghost" onClick={demo.runPair} loading={demo.loading === "pair"} icon={<FiPlay />}>
                  Run the linked-case demo
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Shared accounts", "ACC1015 · ACC1018"],
                ["Shared identifiers", "1 email address"],
                ["Cross-case flows", "ACC1004 → ACC1015 → ACC3006"],
                ["Link score", "Critical · 94 / 100"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/[0.06] bg-ink-900/70 p-4">
                  <div className="label">{k}</div>
                  <div className="mt-1.5 font-mono text-sm text-slate-200">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 pt-24 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-bold text-white sm:text-5xl">
          Start your first investigation <span className="text-gradient">now</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">No setup required. Upload a CSV or explore the demo case to see ThreatLens in action.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton to="/analyze" size="lg" icon={<FiArrowRight />}>
            Get started
          </LinkButton>
          <LinkButton to={GITHUB_URL} external variant="secondary" size="lg">
            Star on GitHub
          </LinkButton>
        </div>
      </section>
    </div>
  );
};

export default Home;
