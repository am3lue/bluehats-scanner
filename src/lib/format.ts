import type { Severity, Verdict } from '@server/types';

export const VERDICT_LABEL: Record<Verdict, string> = {
  safe: 'Looks safe',
  caution: 'Be careful',
  suspicious: 'Suspicious',
  dangerous: 'High risk',
};

export const VERDICT_SHORT: Record<Verdict, string> = {
  safe: 'Safe',
  caution: 'Caution',
  suspicious: 'Suspicious',
  dangerous: 'Dangerous',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export function verdictClass(verdict: Verdict): string {
  return `is-${verdict}`;
}

export function scoreClass(score: number): string {
  if (score >= 75) return 'is-dangerous';
  if (score >= 50) return 'is-suspicious';
  if (score >= 25) return 'is-caution';
  return 'is-safe';
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '--:--:--'
    : date.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function shortHost(host: string): string {
  return host.replace(/^www\./, '');
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export function safeFilename(input: string): string {
  return input.replace(/[^a-z0-9.-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'scan';
}

export function downloadBlob(content: string | Uint8Array, filename: string, type: string): void {
  const blob = new Blob([content as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      if (document.execCommand('copy')) resolve();
      else reject(new Error('Copy failed'));
    } catch (error) {
      reject(error);
    } finally {
      textarea.remove();
    }
  });
}
