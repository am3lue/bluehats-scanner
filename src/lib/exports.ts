import type { ScanResult } from '@server/types';
import { downloadBlob, safeFilename } from './format';

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function logsToCsv(result: ScanResult): string {
  const rows = [
    ['timestamp', 'level', 'phase', 'message'],
    ...result.logs.map((log) => [log.ts, log.level, log.phase, log.message]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export function logsToJson(result: ScanResult): string {
  return JSON.stringify(
    {
      generator: 'BlueHats Scanner',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      scanId: result.id,
      inputUrl: result.inputUrl,
      host: result.host,
      verdict: result.verdict,
      score: result.score,
      scannedAt: result.scannedAt,
      logs: result.logs,
    },
    null,
    2,
  );
}

export function resultToJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function baseFilename(result: ScanResult, suffix: string): string {
  const stamp = new Date(result.scannedAt)
    .toISOString()
    .replace(/[:T]/g, '-')
    .replace(/\..+$/, '');
  return `bluehats-${safeFilename(result.host)}-${stamp}-${suffix}`;
}

export function exportLogsJson(result: ScanResult): void {
  downloadBlob(logsToJson(result), `${baseFilename(result, 'logs')}.json`, 'application/json');
}

export function exportLogsCsv(result: ScanResult): void {
  downloadBlob(logsToCsv(result), `${baseFilename(result, 'logs')}.csv`, 'text/csv;charset=utf-8');
}

export function exportResultJson(result: ScanResult): void {
  downloadBlob(resultToJson(result), `${baseFilename(result, 'report')}.json`, 'application/json');
}

export function reportSummaryText(result: ScanResult): string {
  const lines = [
    `BlueHats Scanner — ${result.verdict.toUpperCase()} (${result.score}/100)`,
    `URL: ${result.inputUrl}`,
    `Host: ${result.host}`,
    `Scanned: ${result.scannedAt}`,
    `Confidence: ${result.confidence}%`,
    '',
    result.summary,
    '',
    'Top signals:',
    ...result.reasons.map((reason) => `- ${reason}`),
    '',
    'This is a heuristic assessment, not proof of safety or malice.',
  ];
  return lines.join('\n');
}
