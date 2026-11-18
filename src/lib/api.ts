import type { DemoCase, LogLine, ReportRecord, ScanResult, Verdict } from '@server/types';

export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || 'https://bluehats-scanner.vercel.app';
export const SITE_NAME = 'BlueHats Scanner';

export interface MetaInfo {
  version: string;
  store: 'turso' | 'local';
  feeds: {
    loaded: boolean;
    generatedAt: string;
    domains: number;
    urls: number;
    sources: { id: string; name: string; count: number; fetchedAt: string; url: string }[];
  };
  demoCases: DemoCase[];
}

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function errorFrom(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  let code: string | undefined;
  try {
    const data = (await response.json()) as { error?: { message?: string; code?: string } };
    if (data.error?.message) message = data.error.message;
    code = data.error?.code;
  } catch {
    /* noop */
  }
  return new ApiError(message, response.status, code);
}

export async function fetchMeta(): Promise<MetaInfo> {
  const response = await fetch('/api/meta', { headers: { accept: 'application/json' } });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as MetaInfo;
}

export async function fetchDemoCases(): Promise<DemoCase[]> {
  const response = await fetch('/api/demo/cases', { headers: { accept: 'application/json' } });
  if (!response.ok) throw await errorFrom(response);
  const data = (await response.json()) as { cases: DemoCase[] };
  return data.cases;
}

export interface ScanInput {
  url?: string;
  brand?: string;
  demoCase?: string;
}

export async function scanOnce(input: ScanInput, signal?: AbortSignal): Promise<ScanResult> {
  const response = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as ScanResult;
}

export interface StreamHandlers {
  onLog?: (log: LogLine) => void;
}

export async function streamScan(input: ScanInput, handlers: StreamHandlers, signal?: AbortSignal): Promise<ScanResult> {
  const response = await fetch('/api/scan/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) throw await errorFrom(response);
  if (!response.body) throw new ApiError('This browser cannot stream the scan log.', 0, 'no_stream');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ScanResult | null = null;
  let streamError: ApiError | null = null;

  const consume = (line: string) => {
    if (!line.trim()) return;
    let payload: { type?: string; log?: LogLine; result?: ScanResult; error?: { message?: string; code?: string } };
    try {
      payload = JSON.parse(line);
    } catch {
      return;
    }
    if (payload.type === 'log' && payload.log) handlers.onLog?.(payload.log);
    if (payload.type === 'result' && payload.result) result = payload.result;
    if (payload.type === 'error') streamError = new ApiError(payload.error?.message ?? 'Scan failed.', 0, payload.error?.code);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) consume(line);
  }
  if (buffer.trim()) consume(buffer);

  if (streamError) throw streamError;
  if (!result) throw new ApiError('The scan finished without a report.', 0, 'empty_result');
  return result;
}

export async function fetchReports(): Promise<ReportRecord[]> {
  const response = await fetch('/api/reports', { headers: { accept: 'application/json' } });
  if (!response.ok) throw await errorFrom(response);
  const data = (await response.json()) as { reports: ReportRecord[] };
  return data.reports;
}

export async function submitReport(input: {
  url: string;
  host: string;
  verdict: Verdict;
  score: number;
  note?: string;
}): Promise<ReportRecord> {
  const response = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await errorFrom(response);
  const data = (await response.json()) as { report: ReportRecord };
  return data.report;
}

export async function updateReport(id: string, patch: { status?: ReportRecord['status']; note?: string }): Promise<ReportRecord> {
  const response = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw await errorFrom(response);
  const data = (await response.json()) as { report: ReportRecord };
  return data.report;
}

export async function deleteReport(id: string): Promise<void> {
  const response = await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw await errorFrom(response);
}

export async function clearReports(): Promise<void> {
  const response = await fetch('/api/reports', { method: 'DELETE' });
  if (!response.ok) throw await errorFrom(response);
}
