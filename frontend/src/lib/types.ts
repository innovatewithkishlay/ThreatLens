export type Severity = "critical" | "high" | "medium" | "low";
export type CaseStatus = "open" | "investigating" | "escalated" | "closed";
export type ReviewStatus = "unreviewed" | "suspicious" | "cleared";

export interface WorkspaceInfo {
  key: string;
  cases: number;
  watchlist: number;
}

export interface ChecklistItem {
  key: string;
  text: string;
  done: boolean;
  auto: boolean;
  doneAt?: string;
}

export interface BenfordResult {
  n: number;
  digits: { digit: number; count: number; observed: number; expected: number }[];
  mad: number;
  conformity: "close" | "acceptable" | "marginal" | "nonconformity";
  applicable: boolean;
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
  benford?: BenfordResult;
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
  checklist?: ChecklistItem[];
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

export interface CaseDetail extends Omit<CaseSummary, "analysis" | "checklist"> {
  checklist: ChecklistItem[];
  notes: string;
  settings: Thresholds;
  thresholds: Partial<Thresholds> | null;
  analyzedAt?: string;
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

export interface Thresholds {
  HIGH_VALUE: number;
  REPORTING_THRESHOLD: number;
  STRUCTURING_BAND: number;
  STRUCTURING_MIN_COUNT: number;
  RAPID_SUCCESSIVE: { count: number; minutes: number };
  SMURFING: { minCounterparties: number; windowHours: number };
  PASS_THROUGH: { windowHours: number; minRatio: number; minAmount: number };
  CIRCULAR: { maxLength: number; maxCycles: number; windowDays: number; minAmount: number; minRatio: number; maxRatio: number };
  FREQUENT_PAIR_COUNT: number;
  ROUND_AMOUNT: { multiple: number; minAmount: number; minCount: number };
  UNUSUAL_HOURS: [number, number];
  NEW_ACCOUNT_DAYS: number;
  NEW_ACCOUNT_HIGH_VALUE: number;
  DORMANT: { days: number; windowDays: number; minAmount: number };
  OUTLIER: { minHistory: number; multiple: number; minAmount: number };
  BENFORD: { minCount: number };
  HIGH_RISK_COUNTRIES: string[];
}

export interface TraceNode {
  account: string;
  hop: number;
  received: number;
  passedOn: number;
  retained: number;
  firstSeen: string | null;
  score: number;
  level: Severity;
  holder?: string;
}

export interface TraceEdge {
  from: string;
  to: string;
  amount: number;
  count: number;
  hop: number;
  transactions: string[];
}

export interface TraceResult {
  origin: string;
  direction: "forward" | "backward";
  maxHops: number;
  totalTraced: number;
  nodes: TraceNode[];
  edges: TraceEdge[];
  endpoints: TraceNode[];
  depth: number;
}

export interface ReportSubject {
  account: string;
  holder: string;
  type?: string;
  country?: string;
  email?: string;
  phone?: string;
  ip?: string;
  inflow: number;
  outflow: number;
  score: number;
  reasons: string[];
}

export interface CaseReport {
  caseId: string;
  name: string;
  generatedAt: string;
  riskScore: number;
  riskLevel: Severity;
  period: { start: string; end: string } | null;
  totals: { transactions: number; volume: number; flaggedVolume: number; currency?: string };
  subjects: ReportSubject[];
  typologies: string[];
  sections: { key: string; title: string; body: string }[];
  narrative: string;
  status: CaseStatus;
  notes: string;
  draft: string;
}

export interface CaseLink {
  case: { _id: string; caseId: string; name: string; riskScore: number; riskLevel: Severity; createdAt: string };
  matches: { kind: "account" | "email" | "mobile" | "ipAddress"; account: string; otherAccount: string; value: string }[];
}

export interface SearchResult {
  query: string;
  entities: {
    account: string;
    holder?: string;
    maxScore: number;
    appearances: { caseId: string; caseRef: string; caseName: string; score: number; level: Severity; email?: string; mobile?: string; ipAddress?: string; inflow?: number; outflow?: number }[];
  }[];
  cases: { _id: string; caseId: string; name: string; riskScore: number; riskLevel: Severity }[];
}

export type WatchlistType = "account" | "name" | "email" | "phone" | "ip";

export interface WatchlistEntry {
  _id: string;
  type: WatchlistType;
  value: string;
  note?: string;
  source?: string;
  createdAt: string;
}
