import fs from 'node:fs/promises';
import path from 'node:path';

export interface FeedSourceMeta {
  id: string;
  name: string;
  url: string;
  kind: 'domains' | 'urls';
  count: number;
  fetchedAt: string;
  lastModified?: string;
  note?: string;
}

export interface FeedDatabase {
  generatedAt: string;
  sources: FeedSourceMeta[];
  domains: string[];
  urls: string[];
}

const EMPTY: FeedDatabase = { generatedAt: '', sources: [], domains: [], urls: [] };
const FEED_PATH = path.resolve(process.cwd(), 'server/data/feeds.json');

let cache: { at: number; db: FeedDatabase; domainSet: Set<string>; urlSet: Set<string> } | null = null;

export async function loadFeeds(): Promise<{
  db: FeedDatabase;
  domainSet: Set<string>;
  urlSet: Set<string>;
  loaded: boolean;
}> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) {
    return { db: cache.db, domainSet: cache.domainSet, urlSet: cache.urlSet, loaded: true };
  }
  try {
    const raw = await fs.readFile(FEED_PATH, 'utf8');
    const db = JSON.parse(raw) as FeedDatabase;
    const domainSet = new Set(db.domains ?? []);
    const urlSet = new Set(db.urls ?? []);
    cache = { at: Date.now(), db, domainSet, urlSet };
    return { db, domainSet, urlSet, loaded: true };
  } catch {
    cache = { at: Date.now(), db: EMPTY, domainSet: new Set(), urlSet: new Set() };
    return { db: EMPTY, domainSet: new Set(), urlSet: new Set(), loaded: false };
  }
}

export function matchFeed(
  host: string,
  registrable: string | null,
  url: string,
  domainSet: Set<string>,
  urlSet: Set<string>,
): { domain?: string; url?: string } {
  if (urlSet.has(url) || urlSet.has(url.replace(/\/$/, ''))) return { url };
  const candidates = [host, registrable, host.replace(/^www\./, '')].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (domainSet.has(candidate)) return { domain: candidate };
  }
  return {};
}

export function feedFreshness(db: FeedDatabase): string | undefined {
  if (!db.generatedAt) return undefined;
  const generated = new Date(db.generatedAt);
  if (Number.isNaN(generated.getTime())) return undefined;
  const hours = Math.max(0, Math.round((Date.now() - generated.getTime()) / 3_600_000));
  if (hours < 1) return 'updated less than an hour ago';
  if (hours < 48) return `updated ${hours} hours ago`;
  return `updated ${Math.round(hours / 24)} days ago`;
}
