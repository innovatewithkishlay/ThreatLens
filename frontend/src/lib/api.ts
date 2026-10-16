import axios, { AxiosError } from "axios";
import type {
  CaseDetail,
  CaseStatus,
  CaseSummary,
  ComparisonResponse,
  ReviewStatus,
  Transaction,
  UploadResult,
  User,
} from "./types";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 120_000,
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
        "Cannot reach the ThreatLens server. Make sure the backend is running.",
        undefined,
        ["Start it with: cd backend && npm run dev"]
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
  authConfig: () => call<{ googleEnabled: boolean }>(http.get("/auth/config")),
  me: () => call<{ user: User | null }>(http.get("/auth/me")),
  logout: () => call<{ message: string }>(http.post("/auth/logout")),
  googleLoginUrl: () => `${API_BASE}/auth/google`,

  listCases: () => call<CaseSummary[]>(http.get("/api/cases")),
  getCase: (id: string) => call<CaseDetail>(http.get(`/api/cases/${id}`)),
  getTransactions: (id: string) => call<Transaction[]>(http.get(`/api/cases/${id}/transactions`)),
  updateCase: (id: string, patch: Partial<{ name: string; description: string; notes: string; status: CaseStatus }>) =>
    call<CaseSummary>(http.patch(`/api/cases/${id}`, patch)),
  deleteCase: (id: string) => call<void>(http.delete(`/api/cases/${id}`)),
  reviewTransaction: (caseId: string, txId: string, status: ReviewStatus) =>
    call<Transaction>(http.patch(`/api/cases/${caseId}/transactions/${txId}`, { status })),
  compare: (a: string, b: string) => call<ComparisonResponse>(http.get(`/api/cases/compare/${a}/${b}`)),
  exportUrl: (id: string, format: "csv" | "json") => `${API_BASE}/api/cases/${id}/export?format=${format}`,

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
