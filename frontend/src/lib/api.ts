import axios, { AxiosError } from "axios";
import type {
  CaseLink,
  CaseReport,
  SearchResult,
  Thresholds,
  TraceResult,
  WatchlistEntry,
  WatchlistType,
  CaseDetail,
  CaseStatus,
  CaseSummary,
  ComparisonResponse,
  ReviewStatus,
  Transaction,
  UploadResult,
  WorkspaceInfo,
  ChecklistItem,
} from "./types";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 120_000,
});

// ---- Workspace key -------------------------------------------------------
// The workspace key travels in a header so the app also works when the API is
// hosted on a different domain (where browsers block third-party cookies).
const KEY_STORAGE = "tl_workspace_key";
const KEY_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

const readKey = () => {
  try {
    const k = localStorage.getItem(KEY_STORAGE);
    return k && KEY_PATTERN.test(k) ? k : null;
  } catch {
    return null;
  }
};

export const saveWorkspaceKey = (key: string) => {
  if (!KEY_PATTERN.test(key)) return;
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    /* storage unavailable - fall back to the cookie */
  }
};

// On first visit ask the server which workspace this browser has (an existing
// cookie-based one, or a fresh key) before sending any other request.
let keyReady: Promise<void> | null = null;
const ensureKey = () => {
  if (readKey()) return Promise.resolve();
  if (!keyReady) {
    keyReady = axios
      .get(`${API_BASE}/api/workspace`, { withCredentials: true, timeout: 120_000 })
      .then((res) => saveWorkspaceKey(res.data?.key || res.headers["x-workspace-key"]))
      .catch(() => undefined)
      .finally(() => {
        keyReady = null;
      });
  }
  return keyReady;
};

http.interceptors.request.use(async (config) => {
  await ensureKey();
  const key = readKey();
  if (key) config.headers.set("X-Workspace-Key", key);
  return config;
});

export class ApiError extends Error {
  status?: number;
  details: string[];
  found?: string[];

  constructor(message: string, status?: number, details: string[] = [], found?: string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.found = found;
  }
}

export const toApiError = (err: unknown): ApiError => {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ error?: string; details?: string[]; found?: string[] }>;
    if (!e.response) {
      return new ApiError(
        "Cannot reach the ThreatLens server.",
        undefined,
        API_BASE
          ? ["The server may be waking up after being idle - please try again in a minute."]
          : ["Make sure the backend is running: cd backend && npm run dev"]
      );
    }
    const data = e.response.data;
    return new ApiError(
      data?.error || `Request failed (${e.response.status})`,
      e.response.status,
      data?.details || [],
      data?.found
    );
  }
  return new ApiError(err instanceof Error ? err.message : "Unexpected error");
};

const call = async <T>(p: Promise<{ data: T }>): Promise<T> => {
  try {
    return (await p).data;
  } catch (err) {
    throw toApiError(err);
  }
};

export const api = {
  workspace: () => call<WorkspaceInfo>(http.get("/api/workspace")),
  joinWorkspace: (key: string) =>
    call<WorkspaceInfo>(http.post("/api/workspace/join", { key })).then((w) => {
      saveWorkspaceKey(w.key);
      return w;
    }),
  newWorkspace: () =>
    call<WorkspaceInfo>(http.post("/api/workspace/new")).then((w) => {
      saveWorkspaceKey(w.key);
      return w;
    }),

  listCases: () => call<CaseSummary[]>(http.get("/api/cases")),
  getCase: (id: string) => call<CaseDetail>(http.get(`/api/cases/${id}`)),
  getTransactions: (id: string) => call<Transaction[]>(http.get(`/api/cases/${id}/transactions`)),
  updateCase: (id: string, patch: Partial<{ name: string; description: string; notes: string; status: CaseStatus; reportDraft: string; checklist: ChecklistItem[] }>) =>
    call<CaseSummary>(http.patch(`/api/cases/${id}`, patch)),
  deleteCase: (id: string) => call<void>(http.delete(`/api/cases/${id}`)),
  reviewTransaction: (caseId: string, txId: string, status: ReviewStatus) =>
    call<Transaction>(http.patch(`/api/cases/${caseId}/transactions/${txId}`, { status })),
  compare: (a: string, b: string) => call<ComparisonResponse>(http.get(`/api/cases/compare/${a}/${b}`)),
  reanalyze: (id: string, thresholds?: Partial<Thresholds> | null) => call<CaseDetail>(http.post(`/api/cases/${id}/reanalyze`, thresholds === undefined ? {} : { thresholds })),
  trace: (id: string, account: string, direction: "forward" | "backward", hops = 6) =>
    call<TraceResult>(http.get(`/api/cases/${id}/trace`, { params: { account, direction, hops } })),
  report: (id: string) => call<CaseReport>(http.get(`/api/cases/${id}/report`)),
  links: (id: string) => call<CaseLink[]>(http.get(`/api/cases/${id}/links`)),
  search: (q: string, signal?: AbortSignal) => call<SearchResult>(http.get("/api/search", { params: { q }, signal })),

  watchlist: () => call<WatchlistEntry[]>(http.get("/api/watchlist")),
  addWatchlist: (entries: { type?: WatchlistType; value: string; note?: string; source?: string }[]) =>
    call<{ added: number; skipped: number }>(http.post("/api/watchlist", { entries })),
  removeWatchlist: (id: string) => call<void>(http.delete(`/api/watchlist/${id}`)),
  clearWatchlist: () => call<void>(http.delete("/api/watchlist")),

  /** Download a case export (sent with the workspace header, so not a plain link). */
  downloadExport: async (id: string, format: "csv" | "json") => {
    try {
      const res = await http.get(`/api/cases/${id}/export`, { params: { format }, responseType: "blob" });
      const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "")?.[1] || `case-${id}.${format}`;
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      throw toApiError(err);
    }
  },

  uploadCase: (file: File, opts: { name?: string; onProgress?: (pct: number) => void } = {}) => {
    const form = new FormData();
    form.append("csvFile", file);
    if (opts.name) form.append("name", opts.name);
    return call<UploadResult>(
      http.post("/api/cases", form, {
        onUploadProgress: (e) => opts.onProgress?.(Math.round((e.loaded * 100) / (e.total || e.loaded || 1))),
      })
    );
  },

  uploadPair: (files: [File, File], onProgress?: (pct: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append("csvFiles", f));
    return call<{ caseA: string; caseB: string }>(
      http.post("/api/cases/pair", form, {
        onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || e.loaded || 1))),
      })
    );
  },
};
