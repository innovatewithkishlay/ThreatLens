import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { AppShell } from "./components/layout/AppShell";
import { CookieBanner } from "./components/layout/CookieBanner";
import { PageLoader } from "./components/ui/Spinner";
import Home from "./pages/Home";
import { lazyPage } from "./lib/lazyPage";

const Analyze = lazyPage(() => import("./pages/Analyze"));
const Cases = lazyPage(() => import("./pages/Cases"));
const CaseView = lazyPage(() => import("./pages/CaseView"));
const CaseReport = lazyPage(() => import("./pages/CaseReport"));
const Watchlist = lazyPage(() => import("./pages/Watchlist"));
const Compare = lazyPage(() => import("./pages/Compare"));
const CompareResults = lazyPage(() => import("./pages/CompareResults"));
const Contribute = lazyPage(() => import("./pages/Contribute"));
const PrivacyPolicy = lazyPage(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = lazyPage(() => import("./pages/CookiePolicy"));
const NotFound = lazyPage(() => import("./pages/NotFound"));
const JoinWorkspace = lazyPage(() => import("./pages/JoinWorkspace"));

const LegacyResults = () => {
  const { caseId } = useParams();
  return <Navigate to={`/cases/${caseId}`} replace />;
};
const LegacyCompare = () => {
  const { case1Id, case2Id } = useParams();
  return <Navigate to={`/compare/${case1Id}/${case2Id}`} replace />;
};

export const App = () => (
  <WorkspaceProvider>
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="analyze" element={<Analyze />} />
            <Route path="cases" element={<Cases />} />
            <Route path="cases/:id" element={<CaseView />} />
            <Route path="cases/:id/report" element={<CaseReport />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="join/:key" element={<JoinWorkspace />} />
            <Route path="compare" element={<Compare />} />
            <Route path="compare/:a/:b" element={<CompareResults />} />
            <Route path="contribute" element={<Contribute />} />
            <Route path="privacy-policy" element={<PrivacyPolicy />} />
            <Route path="cookie-policy" element={<CookiePolicy />} />

            {/* Routes from earlier versions */}
            <Route path="plugin" element={<Navigate to="/analyze" replace />} />
            <Route path="interlink" element={<Navigate to="/compare" replace />} />
            <Route path="results/:caseId" element={<LegacyResults />} />
            <Route path="compare-results/:case1Id/:case2Id" element={<LegacyCompare />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <CookieBanner />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0f141c",
            color: "#e2e8f0",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            fontSize: "14px",
          },
          success: { iconTheme: { primary: "#00ff9d", secondary: "#05070a" } },
          error: { iconTheme: { primary: "#ff4d6d", secondary: "#05070a" } },
        }}
      />
    </BrowserRouter>
  </WorkspaceProvider>
);
