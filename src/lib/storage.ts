import type { ReportRecord, ScanResult } from '@server/types';

const HISTORY_KEY = 'bluehats:history:v1';
const LOCAL_REPORTS_KEY = 'bluehats:reports:v1';
const TOUR_KEY = 'bluehats:tour:v1';
const BOOT_KEY = 'bluehats:boot:v1';

export interface HistoryEntry {
  id: string;
  url: string;
  host: string;
  score: number;
  verdict: ScanResult['verdict'];
  scannedAt: string;
  demoCase?: string;
  result?: ScanResult;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

export function loadHistory(): HistoryEntry[] {
  return readJson<HistoryEntry[]>(HISTORY_KEY, []);
}

export function saveScan(result: ScanResult): HistoryEntry[] {
  const entries = loadHistory().filter((entry) => entry.id !== result.id);
  entries.unshift({
    id: result.id,
    url: result.inputUrl,
    host: result.host,
    score: result.score,
    verdict: result.verdict,
    scannedAt: result.scannedAt,
    demoCase: result.demo?.caseId,
    result,
  });
  const trimmed = entries.slice(0, 25);
  writeJson(HISTORY_KEY, trimmed);
  return trimmed;
}

export function removeScan(id: string): HistoryEntry[] {
  const entries = loadHistory().filter((entry) => entry.id !== id);
  writeJson(HISTORY_KEY, entries);
  return entries;
}

export function clearHistory(): void {
  writeJson(HISTORY_KEY, []);
}

export function loadLocalReports(): ReportRecord[] {
  return readJson<ReportRecord[]>(LOCAL_REPORTS_KEY, []);
}

export function saveLocalReport(report: ReportRecord): ReportRecord[] {
  const reports = loadLocalReports().filter((entry) => entry.id !== report.id);
  reports.unshift(report);
  const trimmed = reports.slice(0, 100);
  writeJson(LOCAL_REPORTS_KEY, trimmed);
  return trimmed;
}

export function updateLocalReport(id: string, patch: Partial<ReportRecord>): ReportRecord[] {
  const reports = loadLocalReports().map((report) =>
    report.id === id ? { ...report, ...patch, updatedAt: new Date().toISOString() } : report,
  );
  writeJson(LOCAL_REPORTS_KEY, reports);
  return reports;
}

export function removeLocalReport(id: string): ReportRecord[] {
  const reports = loadLocalReports().filter((report) => report.id !== id);
  writeJson(LOCAL_REPORTS_KEY, reports);
  return reports;
}

export function clearLocalReports(): void {
  writeJson(LOCAL_REPORTS_KEY, []);
}

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === 'seen';
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_KEY, 'seen');
  } catch {
    /* noop */
  }
}

export function hasBooted(): boolean {
  try {
    return sessionStorage.getItem(BOOT_KEY) === '1';
  } catch {
    return false;
  }
}

export function markBooted(): void {
  try {
    sessionStorage.setItem(BOOT_KEY, '1');
  } catch {
    /* noop */
  }
}
