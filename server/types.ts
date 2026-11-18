export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type CategoryId = 'url' | 'dns' | 'tls' | 'redirects' | 'content' | 'brand' | 'reputation';
export type Verdict = 'safe' | 'caution' | 'suspicious' | 'dangerous';
export type CheckState = 'ok' | 'warn' | 'fail' | 'skip';

export interface Indicator {
  id: string;
  category: CategoryId;
  title: string;
  severity: Severity;
  weight: number;
  explanation: string;
  evidence?: string;
  source?: string;
}

export interface TrustSignal {
  id: string;
  title: string;
  explanation: string;
  source?: string;
  relief: number;
}

export interface CheckStep {
  id: string;
  label: string;
  status: CheckState;
  detail: string;
}

export interface LogLine {
  ts: string;
  level: 'info' | 'success' | 'warn' | 'error';
  phase: string;
  message: string;
}

export interface RedirectHop {
  url: string;
  status: number;
  location?: string;
  note?: string;
}

export interface DnsInfo {
  host: string;
  a: string[];
  aaaa: string[];
  ns: string[];
  mx: string[];
  txt: string[];
  cname: string[];
  spf: string | null;
  dmarc: string | null;
  resolves: boolean;
  error?: string;
  skipped?: boolean;
}

export interface TlsInfo {
  checked: boolean;
  skippedReason?: string;
  authorized?: boolean;
  authorizationError?: string;
  protocol?: string;
  subject?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  ageDays?: number;
  daysLeft?: number;
  fingerprint?: string;
  altNames?: string[];
  selfSigned?: boolean;
  hostnameMatch?: boolean;
}

export interface FormInfo {
  action: string;
  resolvedAction: string;
  method: string;
  hasPassword: boolean;
  crossOrigin: boolean;
}

export interface ContentInfo {
  fetched: boolean;
  status?: number;
  finalUrl?: string;
  title?: string;
  description?: string;
  textSample?: string;
  textLength?: number;
  forms: FormInfo[];
  passwordFields: number;
  iframes: number;
  externalScripts: number;
  obfuscationHits: number;
  metaRefresh?: string;
  favicon?: string;
  copyrightYear?: number;
  error?: string;
}

export interface BrandInfo {
  brand?: string;
  expectedDomain?: string;
  actualDomain?: string;
  domainMatches?: boolean;
  domainDistance?: number;
  titleSimilarity?: number;
  textSimilarity?: number;
  mentionCount?: number;
  detectedFrom?: 'user' | 'content' | 'domain' | 'none';
  referenceUsed?: string;
}

export interface ReputationSource {
  id: string;
  name: string;
  status: 'listed' | 'clear' | 'not_configured' | 'unavailable' | 'skipped';
  listed: boolean;
  detail: string;
  freshness?: string;
  url?: string;
}

export interface ReputationInfo {
  sources: ReputationSource[];
  trancoRank?: number | null;
  trancoDate?: string;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  score: number;
  counts: Record<Severity, number>;
}

export interface ScanResult {
  id: string;
  inputUrl: string;
  host: string;
  registrableDomain: string | null;
  finalUrl: string | null;
  scannedAt: string;
  durationMs: number;
  verdict: Verdict;
  score: number;
  confidence: number;
  summary: string;
  reasons: string[];
  indicators: Indicator[];
  trustSignals: TrustSignal[];
  checks: CheckStep[];
  categories: CategoryScore[];
  redirects: RedirectHop[];
  dns: DnsInfo;
  tls: TlsInfo;
  content: ContentInfo;
  brand: BrandInfo;
  reputation: ReputationInfo;
  logs: LogLine[];
  demo?: { caseId: string; label: string; note: string };
  limitations: string[];
}

export interface DemoCase {
  id: string;
  label: string;
  blurb: string;
  kind: 'safe' | 'caution' | 'suspicious' | 'dangerous';
  displayUrl: string;
  brand?: string;
  brandDomain?: string;
  highlights: string[];
}

export interface ScanRequest {
  url?: string;
  brand?: string;
  demoCase?: string;
}

export interface ReportRecord {
  id: string;
  url: string;
  host: string;
  verdict: Verdict;
  score: number;
  status: 'new' | 'reviewing' | 'confirmed' | 'false_positive';
  note: string;
  createdAt: string;
  updatedAt: string;
}
