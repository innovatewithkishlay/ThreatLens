export type Severity = "critical" | "high" | "medium" | "low";
export type CaseStatus = "open" | "investigating" | "escalated" | "closed";
export type ReviewStatus = "unreviewed" | "suspicious" | "cleared";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface CaseStats {
  transactionCount: number;
  accountCount: number;
  totalVolume: number;
  averageAmount: number;
  maxAmount: number;
  currency?: string;
  dateRange?: { start: string; end: string };
  skippedRows?: number;
  flaggedTransactions: number;
}

export interface AnalysisSummary {
  totalFindings: number;
  severity: Record<Severity, number>;
  byType: Record<string, number>;
  flaggedTransactions: number;
  highRiskAccounts: number;
}

export interface Finding {
  id: string;
  type: string;
  category: string;
  label: string;
  severity: Severity;
  title: string;
  description: string;
  subjects: string[];
  accounts: string[];
  transactions: string[];
  amount: number;
  meta: Record<string, unknown>;
}

export interface AccountRisk {
  account: string;
  holder?: string;
  type?: string;
  country?: string;
  inflow: number;
  outflow: number;
  sent: number;
  received: number;
  score: number;
  level: Severity;
  reasons: string[];
}

export interface NetworkNode {
  id: string;
  label: string;
  score: number;
  level?: Severity;
  inflow?: number;
  outflow?: number;
  country?: string;
  membership?: "A" | "B" | "both";
}

export interface NetworkEdge {
  from: string;
  to: string;
  totalAmount: number;
  count: number;
  flagged?: boolean;
  cases?: string;
}

export interface Analysis {
  summary: AnalysisSummary;
  findings: Finding[];
  accountRisk: AccountRisk[];
  network: { nodes: NetworkNode[]; edges: NetworkEdge[] };
  activity: {
    hourly: number[];
    daily: { date: string; count: number; volume: number; flagged: number }[];
  };
  geography: { country: string; count: number; volume: number; highRisk: boolean; flagged: number }[];
  thresholds: { highValue: number; reportingThreshold: number; highRiskCountries: string[] };
  columns?: Record<string, string>;
}

export interface CaseSummary {
  _id: string;
  caseId: string;
  name: string;
  description?: string;
  sourceFile?: string;
  status: CaseStatus;
  stats: CaseStats;
  riskScore: number;
  riskLevel: Severity;
  createdAt: string;
  updatedAt: string;
  analysis?: { summary: AnalysisSummary };
}

export interface Account {
  _id: string;
  accountNumber: string;
  accountHolder?: string;
  accountType?: string;
  openedAt?: string;
  country?: string;
  metadata?: { email?: string; mobile?: string; ipAddress?: string };
  stats: { inflow: number; outflow: number; sent: number; received: number };
  riskScore: number;
  riskLevel: Severity;
  reasons: string[];
}

export interface CaseDetail extends Omit<CaseSummary, "analysis"> {
  notes: string;
  warnings: string[];
  analysis: Analysis;
  accounts: Account[];
}

export interface Transaction {
  _id: string;
  row?: number;
  reference?: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency?: string;
  date?: string | null;
  description?: string;
  country?: string;
  isSuspicious: boolean;
  flags: string[];
  reviewStatus: ReviewStatus;
}

export interface UploadResult {
  id: string;
  caseId: string;
  name: string;
  riskScore: number;
  riskLevel: Severity;
  stats: CaseStats;
  warnings: string[];
}

export interface ComparisonCase {
  _id: string;
  caseId: string;
  name: string;
  riskScore: number;
  riskLevel: Severity;
  stats: CaseStats;
  createdAt: string;
}

export interface SharedAccountProfile {
  sent: number;
  received: number;
  outflow: number;
  inflow: number;
  score: number;
  level: Severity;
}

export interface Comparison {
  linkScore: number;
  linkLevel: Severity;
  verdict: string;
  factors: { key: string; label: string; value: number; points: number }[];
  sharedAccounts: { account: string; caseA: SharedAccountProfile; caseB: SharedAccountProfile }[];
  sharedIdentifiers: { field: string; label: string; value: string; accountsA: string[]; accountsB: string[] }[];
  crossCaseFlows: {
    direction: string;
    path: string[];
    via: string;
    amountIn: number;
    amountOut: number;
    gapHours: number | null;
  }[];
  similarity: { typologies: number; amounts: number; timeOfDay: number; overall: number };
  commonTypologies: string[];
  temporal: {
    caseA: { start: string; end: string } | null;
    caseB: { start: string; end: string } | null;
    overlap: { start: string; end: string; days: number } | null;
  };
  geography: { caseA: string[]; caseB: string[]; commonCountries: string[]; commonHighRisk: string[] };
  network: { nodes: NetworkNode[]; edges: NetworkEdge[] };
}

export interface ComparisonResponse {
  caseA: ComparisonCase;
  caseB: ComparisonCase;
  comparison: Comparison;
}
