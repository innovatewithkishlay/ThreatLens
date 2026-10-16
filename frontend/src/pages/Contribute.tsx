import { FiBookOpen, FiCode, FiCpu, FiGitPullRequest, FiGithub, FiLayers, FiMail, FiShield } from "react-icons/fi";
import { PageContainer, PageHeader } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { LinkButton } from "../components/ui/Button";
import { GITHUB_URL } from "../components/layout/Navbar";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const AREAS = [
  { icon: <FiCpu />, title: "Detection engine", text: "Add new typologies, tune thresholds and improve scoring - see backend/app/utils/anomalyDetector.js." },
  { icon: <FiLayers />, title: "Visualisation", text: "Better network layouts, Sankey flows, timeline playback and investigator UX." },
  { icon: <FiCode />, title: "Platform", text: "Performance for large files, background jobs, team workspaces and role-based access." },
  { icon: <FiShield />, title: "Domain expertise", text: "Share real-world AML typologies, review detections and help define compliance workflows." },
  { icon: <FiBookOpen />, title: "Documentation", text: "Guides, tutorials and sample datasets that help new investigators get started." },
  { icon: <FiGitPullRequest />, title: "Testing", text: "Extend the node:test suites and add end-to-end coverage for the frontend." },
];

const STEPS = [
  ["Fork & clone", "git clone https://github.com/<you>/ThreatLens.git"],
  ["Run locally", "cd backend && npm install && npm run dev\ncd frontend && npm install && npm run dev"],
  ["Test", "cd backend && npm test\ncd frontend && npm run lint && npm run build"],
  ["Open a PR", "Describe the change, link an issue and include screenshots for UI work."],
];

const Contribute = () => {
  useDocumentTitle("Contribute");
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Open source"
        title="Help build ThreatLens"
        description="ThreatLens is MIT-licensed and community driven. Whether you write code, design interfaces or investigate financial crime, there's a place for you."
        actions={
          <>
            <LinkButton to={GITHUB_URL} external icon={<FiGithub />}>View on GitHub</LinkButton>
            <LinkButton to="mailto:kishlay141@gmail.com" external variant="secondary" icon={<FiMail />}>Get in touch</LinkButton>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map((a) => (
          <Card key={a.title} className="card-hover p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-lg text-accent ring-1 ring-accent/20">{a.icon}</div>
            <h3 className="mt-4 font-semibold text-white">{a.title}</h3>
            <p className="mt-1.5 text-sm text-slate-400">{a.text}</p>
          </Card>
        ))}
      </div>
      <h2 className="mb-4 mt-14 font-display text-2xl font-bold text-white">Getting started</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {STEPS.map(([title, code], i) => (
          <Card key={title} className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent font-mono text-sm font-bold text-ink-950">{i + 1}</span>
              <h3 className="font-semibold text-white">{title}</h3>
            </div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-ink-950 p-3 font-mono text-xs text-slate-300">{code}</pre>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
};

export default Contribute;
