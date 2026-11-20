import crypto from 'node:crypto';
import ipaddr from 'ipaddr.js';
import { parse as parseDomain } from 'tldts';
import * as cheerio from 'cheerio';

export function sha256(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - levenshtein(a, b) / longest;
}

const STOP_WORDS = new Set(
  'the a an and or of to in for on at with from by is are was were be been your you our we this that it its as if then than can will not have has had please sign into log in out'.split(
    ' ',
  ),
);

export function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
      .slice(0, 800),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

export function registrableDomain(host: string): string | null {
  const parsed = parseDomain(host, { allowPrivateDomains: true });
  return parsed.domain ?? null;
}

export function isIpHost(host: string): boolean {
  return ipaddr.isValid(host.replace(/^\[|\]$/g, ''));
}

const BLOCKED_CIDRS_V4 = new Set([
  'unspecified',
  'broadcast',
  'multicast',
  'linkLocal',
  'loopback',
  'private',
  'reserved',
  'carrierGradeNat',
  'uniqueLocal',
]);

const BLOCKED_CIDRS_V6 = new Set([
  'unspecified',
  'loopback',
  'linkLocal',
  'uniqueLocal',
  'multicast',
  'reserved',
  'ipv4Mapped',
  'rfc6145',
  'rfc6052',
  '6to4',
  'teredo',
]);

export function isPublicIp(ip: string): boolean {
  const cleaned = ip.replace(/^\[|\]$/g, '');
  if (!ipaddr.isValid(cleaned)) return false;
  const parsed = ipaddr.parse(cleaned);
  const range = parsed.range();
  if (parsed.kind() === 'ipv4') return !BLOCKED_CIDRS_V4.has(range);
  const mapped = parsed as ipaddr.IPv6;
  if (mapped.isIPv4MappedAddress()) {
    return isPublicIp(mapped.toIPv4Address().toString());
  }
  return !BLOCKED_CIDRS_V6.has(range);
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function normalizeInputUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Paste a link to scan.');
  if (trimmed.length > 2048) throw new Error('That link is too long to scan safely (max 2048 characters).');
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error('That does not look like a valid link.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https links can be scanned.');
  }
  if (!url.hostname || !url.hostname.includes('.')) {
    throw new Error('That link needs a full domain name, for example example.com.');
  }
  if (url.username || url.password) {
    throw new Error('Links with embedded usernames or passwords are blocked for safety.');
  }
  url.hash = '';
  return url;
}

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token|key|secret|session|auth|password|code|email/i.test(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }
    return parsed.toString();
  } catch {
    return url.replace(/[?&]([^=]+)=([^&]+)/g, (match, key) =>
      /token|key|secret|session|auth|password/i.test(String(key)) ? `${match.split('=')[0]}=[redacted]` : match,
    );
  }
}

export async function scrapeUrl(url: string): Promise<{
  title: string;
  description: string;
  links: string[];
  text: string;
} | null> {
  try {
    const { safeFetch } = await import('./safeFetch.js');
    const fetchResult = await safeFetch(url, {
      maxRedirects: 2,
      timeoutMs: 8000,
      maxBytes: 2_000_000,
    });
    const $ = cheerio.load(fetchResult.body);
    const title = ($('title').first().text() || '').trim().slice(0, 300);
    const description = ($('meta[name="description"]').attr('content') || '').trim().slice(0, 400);
    const links = $('a')
      .map((_, element) => $(element).attr('href') || '')
      .get()
      .filter(Boolean)
      .slice(0, 20)
      .map((href) => {
        try {
          return new URL(href, fetchResult.finalUrl).toString();
        } catch {
          return href;
        }
      });
    const text = $('body')
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    return { title, description, links, text };
  } catch (error) {
    console.error('[scrape] failed:', error);
    return null;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatHost(host: string): string {
  return host.replace(/^www\./, '');
}
