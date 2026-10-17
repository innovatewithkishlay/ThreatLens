import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { RootErrorBoundary } from "./components/layout/RootErrorBoundary";
import { reloadOnce } from "./lib/lazyPage";

// Vite fires this when a lazily loaded file can't be fetched (e.g. after a redeploy).
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnce()) event.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
);
