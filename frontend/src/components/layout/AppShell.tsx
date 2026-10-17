import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { PageLoader } from "../ui/Spinner";
import { ErrorBoundary } from "./ErrorBoundary";

export const Background = () => (
  <div aria-hidden className="no-print pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="grid-bg absolute inset-0 animate-grid-pan [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
    <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-[120px]" />
    <div className="absolute -right-40 top-1/3 h-[420px] w-[420px] rounded-full bg-cyan-glow/[0.05] blur-[120px]" />
  </div>
);

export const AppShell = () => {
  const { pathname } = useLocation();
  // Block body on purpose: newer browsers return a Promise from scrollTo, which
  // React would otherwise treat as a cleanup function and crash on navigation.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <Background />
      <Navbar />
      <main className="relative z-10 flex-1">
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
};

export const PageContainer = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 ${className}`}>{children}</div>
);

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      {eyebrow && <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">{eyebrow}</div>}
      <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-slate-400">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);
