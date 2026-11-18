#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const FULL = process.argv.includes('--full');
const OUT = path.resolve(process.cwd(), 'server/data/feeds.json');
const UA = 'BlueHatsScanner/1.0 (offline reputation snapshot; +https://bluehats-scanner.vercel.app)';

const SOURCES = [
  {
    id: 'openphish',
    name: 'OpenPhish community feed',
    url: 'https://openphish.com/feed.txt',
    kind: 'urls',
    note: 'Live community feed of phishing URLs (keyless).',
  },
  {
    id: 'cert-pl',
    name: 'CERT Polska warning list',
    url: 'https://hole.cert.pl/domains/v2/domains.txt',
    kind: 'domains',
    note: 'Public list of malicious domains maintained by CERT Polska (keyless).',
  },
  {
    id: 'spam404',
    name: 'Spam404 blacklist',
    url: 'https://raw.githubusercontent.com/Spam404/lists/master/main-blacklist.txt',
    kind: 'domains',
    note: 'Community scam and phishing domain list (keyless).',
  },
  ...(FULL
    ? [
        {
          id: 'phishing-database',
          name: 'Phishing.Database (active)',
          url: 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt',
          kind: 'domains',
          note: 'Large community active-phishing domain set (keyless, full mode only).',
        },
      ]
    : []),
];

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function normalizeDomain(value) {
  let text = value.trim().toLowerCase();
  if (!text || text.startsWith('#') || text.startsWith('!')) return null;
  text = text.replace(/^0\.0\.0\.0\s+/, '').replace(/^127\.0\.0\.1\s+/, '');
  if (text.includes('://')) {
    try {
      text = new URL(text).hostname;
    } catch {
      return null;
    }
  }
  text = text.split(/[\s/]/)[0].replace(/\.$/, '');
  if (text.startsWith('*.')) text = text.slice(2);
  if (text.startsWith('www.')) text = text.slice(4);
  if (!DOMAIN_RE.test(text)) return null;
  return text;
}

function normalizeUrl(value) {
  const text = value.trim();
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(text);
    if (!url.hostname.includes('.')) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: 'text/plain,*/*' },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return {
      text,
      lastModified: response.headers.get('last-modified') ?? undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

const domains = new Set();
const urls = new Set();
const sources = [];

for (const source of SOURCES) {
  process.stdout.write(`[feeds] ${source.name} … `);
  try {
    const { text, lastModified } = await fetchSource(source);
    let count = 0;
    for (const line of text.split(/\r?\n/)) {
      if (source.kind === 'urls') {
        const normalized = normalizeUrl(line);
        if (normalized) {
          urls.add(normalized);
          const host = normalizeDomain(normalized);
          if (host) domains.add(host);
          count++;
        }
      } else {
        const normalized = normalizeDomain(line);
        if (normalized) {
          domains.add(normalized);
          count++;
        }
      }
    }
    sources.push({
      id: source.id,
      name: source.name,
      url: source.url,
      kind: source.kind,
      count,
      fetchedAt: new Date().toISOString(),
      lastModified,
      note: source.note,
    });
    console.log(`${count.toLocaleString()} entries`);
  } catch (error) {
    console.log(`failed (${error.message})`);
  }
}

if (!sources.length) {
  console.error('[feeds] No source could be downloaded. Check the network and try again.');
  process.exitCode = 1;
} else {
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const snapshot = {
    generatedAt: new Date().toISOString(),
    sources,
    domains: [...domains].sort(),
    urls: [...urls].sort(),
  };
  await fs.writeFile(OUT, JSON.stringify(snapshot), 'utf8');
  console.log(
    `[feeds] wrote ${path.relative(process.cwd(), OUT)} · ${domains.size.toLocaleString()} domains · ${urls.size.toLocaleString()} urls`,
  );
}
