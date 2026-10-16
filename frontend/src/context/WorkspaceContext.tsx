import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { WorkspaceInfo } from "../lib/types";

interface WorkspaceState {
  workspace: WorkspaceInfo | null;
  refresh: () => Promise<void>;
  join: (key: string) => Promise<WorkspaceInfo>;
  startNew: () => Promise<WorkspaceInfo>;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

/** No accounts: each browser has a private workspace identified by a key. */
export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);

  const refresh = useCallback(async () => {
    try {
      setWorkspace(await api.workspace());
    } catch {
      /* the API may be offline; pages show their own errors */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const join = useCallback(async (key: string) => {
    const w = await api.joinWorkspace(key);
    setWorkspace(w);
    return w;
  }, []);

  const startNew = useCallback(async () => {
    const w = await api.newWorkspace();
    setWorkspace(w);
    return w;
  }, []);

  const value = useMemo(() => ({ workspace, refresh, join, startNew }), [workspace, refresh, join, startNew]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
};
