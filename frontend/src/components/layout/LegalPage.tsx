import { PageContainer } from "./AppShell";

export const LegalPage = ({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) => (
  <PageContainer className="max-w-3xl">
    <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Legal</div>
    <h1 className="mt-2 font-display text-4xl font-bold text-white">{title}</h1>
    <p className="mt-2 text-sm text-slate-500">Last updated {updated}</p>
    <div className="card prose-tl mt-8 p-6 sm:p-8 [&>h2:first-child]:mt-0">{children}</div>
  </PageContainer>
);
