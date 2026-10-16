import { Component, type ErrorInfo, type ReactNode } from "react";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { isChunkLoadError, reloadOnce } from "../../lib/lazyPage";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Keeps a crash in one page from blanking the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[threatlens] Page crashed:", error, info.componentStack);
    if (isChunkLoadError(error)) reloadOnce();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sev-critical/10 text-2xl text-sev-critical ring-1 ring-sev-critical/30">
          <FiAlertTriangle />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-white">This page failed to load</h1>
        <p className="mt-2 text-sm text-slate-400">{this.state.error.message || "An unexpected error occurred."}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-accent-soft"
        >
          <FiRefreshCw /> Reload
        </button>
      </div>
    );
  }
}
