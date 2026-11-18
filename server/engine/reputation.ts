import dns from 'node:dns/promises';
import type { Indicator, ReputationInfo, ReputationSource, TrustSignal } from '../types.js';
import { feedFreshness, loadFeeds, matchFeed } from './feeds.js';

const DNSBL_TIMEOUT = 3000;
const cache = new Map<string, { at: number; info: ReputationInfo; indicators: Indicator[]; trustSignals: TrustSignal[] }>();

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function dnsblQuery(domain: string, zone: string): Promise<'listed' | 'clear' | 'unavailable'> {
  try {
    const records = await Promise.race([
      dns.resolve4(`${domain}.${zone}`),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('timeout')), DNSBL_TIMEOUT)),
    ]);
    return records.length ? 'listed' : 'clear';
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') return 'clear';
    return 'unavailable';
  }
}

async function tranco(domain: string): Promise<{ rank: number | null; date?: string; status: 'ok' | 'unavailable' }> {
  try {
    const response = await fetch(`https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`, {
      signal: timeoutSignal(3500),
      headers: { accept: 'application/json', 'user-agent': 'BlueHatsScanner/1.0' },
    });
    if (!response.ok) return { rank: null, status: 'unavailable' };
    const data = (await response.json()) as { ranks?: { rank: number; date: string }[] };
    const latest = data.ranks?.[0];
    return { rank: latest?.rank ?? null, date: latest?.date, status: 'ok' };
  } catch {
    return { rank: null, status: 'unavailable' };
  }
}

async function safeBrowsing(url: string, key: string): Promise<ReputationSource> {
  try {
    const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      signal: timeoutSignal(4000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: 'bluehats-scanner', clientVersion: '1.0.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!response.ok) {
      return { id: 'safe-browsing', name: 'Google Safe Browsing', status: 'unavailable', listed: false, detail: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as { matches?: unknown[] };
    const listed = Boolean(data.matches?.length);
    return {
      id: 'safe-browsing',
      name: 'Google Safe Browsing',
      status: listed ? 'listed' : 'clear',
      listed,
      detail: listed ? 'URL matched a Safe Browsing threat list' : 'No match in Safe Browsing',
      freshness: 'queried live',
      url: 'https://developers.google.com/safe-browsing',
    };
  } catch {
    return { id: 'safe-browsing', name: 'Google Safe Browsing', status: 'unavailable', listed: false, detail: 'Request failed' };
  }
}

async function urlhaus(url: string, key: string): Promise<ReputationSource> {
  try {
    const response = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
      method: 'POST',
      signal: timeoutSignal(4000),
      headers: { 'Auth-Key': key, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url }).toString(),
    });
    if (!response.ok) {
      return { id: 'urlhaus', name: 'URLhaus', status: 'unavailable', listed: false, detail: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as { query_status?: string; url_status?: string };
    const listed = data.query_status === 'ok';
    return {
      id: 'urlhaus',
      name: 'URLhaus',
      status: listed ? 'listed' : 'clear',
      listed,
      detail: listed ? `Known URL (${data.url_status ?? 'unknown status'})` : 'No match in URLhaus',
      freshness: 'queried live',
      url: 'https://urlhaus.abuse.ch',
    };
  } catch {
    return { id: 'urlhaus', name: 'URLhaus', status: 'unavailable', listed: false, detail: 'Request failed' };
  }
}

async function virusTotal(url: string, key: string): Promise<ReputationSource> {
  try {
    const id = Buffer.from(url).toString('base64url');
    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${id}`, {
      signal: timeoutSignal(4500),
      headers: { 'x-apikey': key, accept: 'application/json' },
    });
    if (response.status === 404) {
      return { id: 'virustotal', name: 'VirusTotal', status: 'clear', listed: false, detail: 'URL not seen by VirusTotal', freshness: 'queried live' };
    }
    if (!response.ok) {
      return { id: 'virustotal', name: 'VirusTotal', status: 'unavailable', listed: false, detail: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as { data?: { attributes?: { last_analysis_stats?: Record<string, number> } } };
    const malicious = data.data?.attributes?.last_analysis_stats?.malicious ?? 0;
    return {
      id: 'virustotal',
      name: 'VirusTotal',
      status: malicious > 0 ? 'listed' : 'clear',
      listed: malicious > 0,
      detail: malicious > 0 ? `${malicious} engines flag this URL` : 'No engine flags on record',
      freshness: 'queried live',
      url: 'https://www.virustotal.com',
    };
  } catch {
    return { id: 'virustotal', name: 'VirusTotal', status: 'unavailable', listed: false, detail: 'Request failed' };
  }
}

function notConfigured(id: string, name: string, url?: string): ReputationSource {
  return {
    id,
    name,
    status: 'not_configured',
    listed: false,
    detail: 'Add a free API key to enable this source',
    url,
  };
}

export async function inspectReputation(options: {
  url: string;
  host: string;
  registrable: string | null;
  demo?: boolean;
}): Promise<{ info: ReputationInfo; indicators: Indicator[]; trustSignals: TrustSignal[] }> {
  const { url, host, registrable, demo } = options;
  const cacheKey = `${demo ? 'demo:' : ''}${registrable ?? host}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
    return { info: cached.info, indicators: cached.indicators, trustSignals: cached.trustSignals };
  }

  const indicators: Indicator[] = [];
  const trustSignals: TrustSignal[] = [];
  const sources: ReputationSource[] = [];

  const feeds = await loadFeeds();
  const freshness = feedFreshness(feeds.db);

  if (!feeds.loaded) {
    sources.push({
      id: 'community-feeds',
      name: 'Community phishing feeds',
      status: 'unavailable',
      listed: false,
      detail: 'No local feed snapshot. Run "npm run feeds" to arm the offline lists.',
    });
  } else {
    const match = matchFeed(host, registrable, url, feeds.domainSet, feeds.urlSet);
    for (const source of feeds.db.sources) {
      sources.push({
        id: `feed-${source.id}`,
        name: source.name,
        status: 'clear',
        listed: false,
        detail: `${source.count.toLocaleString()} entries in snapshot`,
        freshness: freshness ?? source.fetchedAt,
        url: source.url,
      });
    }
    if (match.domain || match.url) {
      const matchedSources = feeds.db.sources.map((source) => source.name);
      sources.unshift({
        id: 'feed-match',
        name: 'Community phishing feeds',
        status: 'listed',
        listed: true,
        detail: `Matched ${match.domain ? `domain "${match.domain}"` : `URL "${match.url}"`} in ${matchedSources.join(', ')}`,
        freshness: freshness ?? feeds.db.generatedAt,
      });
      indicators.push({
        id: 'reputation-feed-match',
        category: 'reputation',
        title: 'Listed in a phishing feed',
        severity: 'critical',
        weight: 55,
        explanation: `The ${match.domain ? 'domain' : 'exact URL'} appears in a public phishing blocklist snapshot. These lists are not perfect, but inclusion is a strong reason not to enter anything on the page.`,
        evidence: match.domain ?? match.url,
        source: 'Community feeds',
      });
    } else {
      sources.unshift({
        id: 'community-feeds',
        name: 'Community phishing feeds',
        status: 'clear',
        listed: false,
        detail: `${(feeds.db.domains.length + feeds.db.urls.length).toLocaleString()} entries checked — no match`,
        freshness,
      });
      trustSignals.push({
        id: 'reputation-not-listed',
        title: 'Not present in the local phishing feed snapshot',
        explanation: 'The domain was not found in the public phishing lists bundled with this build. Absence from a list is not proof of safety.',
        relief: 3,
        source: 'Community feeds',
      });
    }
  }

  if (demo) {
    sources.push({
      id: 'spamhaus-dbl',
      name: 'Spamhaus DBL',
      status: 'skipped',
      listed: false,
      detail: 'Skipped for a local demo fixture',
    });
    sources.push({
      id: 'surbl',
      name: 'SURBL',
      status: 'skipped',
      listed: false,
      detail: 'Skipped for a local demo fixture',
    });
    sources.push({
      id: 'tranco',
      name: 'Tranco popularity',
      status: 'skipped',
      listed: false,
      detail: 'Local fixtures have no public popularity rank',
    });
    cache.set(cacheKey, { at: Date.now(), info: { sources }, indicators, trustSignals });
    return { info: { sources }, indicators, trustSignals };
  }

  if (registrable) {
    const [spamhaus, surbl] = await Promise.all([
      dnsblQuery(registrable, 'dbl.spamhaus.org'),
      dnsblQuery(registrable, 'multi.surbl.org'),
    ]);

    for (const [id, name, state, url] of [
      ['spamhaus-dbl', 'Spamhaus DBL', spamhaus, 'https://www.spamhaus.org/dbl/'],
      ['surbl', 'SURBL', surbl, 'https://www.surbl.org/'],
    ] as const) {
      const listed = state === 'listed';
      sources.push({
        id,
        name,
        status: state === 'unavailable' ? 'unavailable' : listed ? 'listed' : 'clear',
        listed,
        detail:
          state === 'unavailable'
            ? 'DNS blocklist did not answer'
            : listed
              ? 'Domain is listed on this blocklist'
              : 'Domain is not listed',
        freshness: 'queried live',
        url,
      });
      if (listed) {
        indicators.push({
          id: `reputation-${id}`,
          category: 'reputation',
          title: `Listed on ${name}`,
          severity: 'high',
          weight: 28,
          explanation: `${name} lists "${registrable}". These blocklists track spam and malware domains and are used by mail providers worldwide. False positives happen, but a listing deserves attention.`,
          evidence: registrable,
          source: name,
        });
      }
    }

    const popularity = await tranco(registrable);
    if (popularity.status === 'ok' && popularity.rank) {
      sources.push({
        id: 'tranco',
        name: 'Tranco popularity',
        status: 'clear',
        listed: false,
        detail: `Rank #${popularity.rank.toLocaleString()}${popularity.rank <= 10_000 ? ' — a very popular domain' : ''}`,
        freshness: popularity.date ? `rank from ${popularity.date}` : 'queried live',
        url: 'https://tranco-list.eu',
      });
      if (popularity.rank <= 10_000) {
        trustSignals.push({
          id: 'reputation-popular',
          title: 'Domain is highly popular',
          explanation: `Tranco ranks this domain #${popularity.rank.toLocaleString()}, which is consistent with an established site.`,
          relief: 6,
          source: 'Tranco',
        });
      }
      sources[sources.length - 1].listed = false;
    } else {
      sources.push({
        id: 'tranco',
        name: 'Tranco popularity',
        status: popularity.status === 'ok' ? 'clear' : 'unavailable',
        listed: false,
        detail: popularity.status === 'ok' ? 'Not ranked in the top one million' : 'Popularity service did not answer',
        freshness: popularity.status === 'ok' ? 'queried live' : undefined,
        url: 'https://tranco-list.eu',
      });
    }
  }

  const keyed: Promise<ReputationSource>[] = [];
  if (process.env.GOOGLE_SAFE_BROWSING_KEY) keyed.push(safeBrowsing(url, process.env.GOOGLE_SAFE_BROWSING_KEY));
  else sources.push(notConfigured('safe-browsing', 'Google Safe Browsing', 'https://developers.google.com/safe-browsing'));
  if (process.env.URLHAUS_AUTH_KEY) keyed.push(urlhaus(url, process.env.URLHAUS_AUTH_KEY));
  else sources.push(notConfigured('urlhaus', 'URLhaus', 'https://urlhaus.abuse.ch/api/'));
  if (process.env.VIRUSTOTAL_API_KEY) keyed.push(virusTotal(url, process.env.VIRUSTOTAL_API_KEY));
  else sources.push(notConfigured('virustotal', 'VirusTotal', 'https://www.virustotal.com/gui/join-us'));
  if (process.env.PHISHTANK_KEY) {
    sources.push({
      id: 'phishtank',
      name: 'PhishTank',
      status: 'not_configured',
      listed: false,
      detail: 'Adapter reserved — enable after confirming the current PhishTank API terms',
      url: 'https://phishtank.org',
    });
  } else {
    sources.push(notConfigured('phishtank', 'PhishTank', 'https://phishtank.org'));
  }

  if (keyed.length) {
    const results = await Promise.all(keyed);
    for (const result of results) {
      sources.push(result);
      if (result.listed) {
        indicators.push({
          id: `reputation-${result.id}`,
          category: 'reputation',
          title: `Flagged by ${result.name}`,
          severity: 'critical',
          weight: 45,
          explanation: `${result.name} reports this URL as malicious. This is one of the strongest signals available and should override most reassuring heuristics.`,
          evidence: result.detail,
          source: result.name,
        });
      }
    }
  }

  const info: ReputationInfo = {
    sources,
    trancoRank: sources.find((source) => source.id === 'tranco')?.detail.match(/#([\d,]+)/)?.[1]
      ? Number(sources.find((source) => source.id === 'tranco')!.detail.match(/#([\d,]+)/)![1].replace(/,/g, ''))
      : null,
  };

  cache.set(cacheKey, { at: Date.now(), info, indicators, trustSignals });
  return { info, indicators, trustSignals };
}
