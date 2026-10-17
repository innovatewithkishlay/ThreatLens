import { Component, type ErrorInfo, type ReactNode } from "react";

const FLAG = "tl_root_recover";

interface State {
  error: Error | null;
}

/**
 * Last line of defence: if anything above the page level crashes, reload the
 * page once (what a manual refresh would do). If it crashes again right away,
 * show the error instead of a blank screen so it can be reported.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[threatlens] App crashed:", error, info.componentStack);
    try {
      const last = Number(sessionStorage.getItem(FLAG) || 0);
      if (Date.now() - last > 15_000) {
        sessionStorage.setItem(FLAG, String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* storage unavailable - show the fallback */
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, system-ui, sans-serif", color: "#e2e8f0" }}>
        <div style={{ maxWidth: 560, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>Something went wrong</h1>
          <p style={{ marginTop: 8, color: "#94a3b8", fontSize: 14 }}>ThreatLens hit an unexpected error. Reloading usually fixes it.</p>
          <pre style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#0f141c", border: "1px solid rgba(255,255,255,0.08)", color: "#ff8fa3", fontSize: 12, textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {error.name}: {error.message}
            {"\n"}build {__BUILD__}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, background: "#00ff9d", color: "#05070a", fontWeight: 600, border: 0, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
