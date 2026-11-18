import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import type { CheckStep, DemoCase, DnsInfo, LogLine, ScanResult, TlsInfo } from '../types.js';
import { analyzeBrand, type BrandReference } from './brand.js';
import { analyzeContent } from './content.js';
import { inspectDns } from './dns.js';
import { findDemoCase, FIXTURE_PAGES } from '../fixtures/index.js';
import { analyzeRedirects } from './redirects.js';
import { inspectReputation } from './reputation.js';
import { assertPublicTarget, safeFetch, SafetyError } from './safeFetch.js';
import { LIMITATIONS, scoreFinding } from './scoring.js';
import { inspectTls } from './tls.js';
import { analyzeUrl } from './url.js';
import { isPublicIp, normalizeInputUrl, registrableDomain, redactUrl } from './utils.js';

export interface ScanOptions {
  url?: string;
  brand?: string;
  demoCase?: string;
  emit?: (line: LogLine) => void;
}

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const started = Date.now();
  const logs: LogLine[] = [];
  const emit = (level: LogLine['level'], phase: string, message: string) => {
    const line: LogLine = { ts: new Date().toISOString(), level, phase, message };
    logs.push(line);
    options.emit?.(line);
  };

  const id = crypto.randomUUID();
  const fixture = options.demoCase ? findDemoCase(options.demoCase) : null;
  if (options.demoCase && !fixture) throw new Error('Unknown demo case.');

  const inputUrl = fixture ? fixture.displayUrl : String(options.url ?? '');
  emit('info', 'boot', `bluehats scanner v1.0 · run ${id.slice(0, 8)}`);
  emit('info', 'parse', fixture ? `Demo case "${fixture.label}" loaded` : `Target received · ${redactUrl(inputUrl)}`);

  let target: URL;
  try {
    target = normalizeInputUrl(inputUrl);
  } catch (error) {
    emit('error', 'parse', (error as Error).message);
    throw error;
  }

  const analysis = analyzeUrl(target);
  const urlFacts = analysis.facts;
  const urlAnalysis = analysis;
  emit(
    'info',
    'parse',
    `Host ${urlFacts.host}${urlFacts.registrable ? ` · registrable ${urlFacts.registrable}` : ''}${urlFacts.isIp ? ' · literal IP' : ''}`,
  );

  if (!fixture) {
    try {
      const pinned = await assertPublicTarget(urlFacts.host);
      emit('success', 'guard', `SSRF guard passed · ${pinned.address}`);
    } catch (error) {
      emit('error', 'guard', (error as Error).message);
      throw error;
    }
  } else {
    emit('warn', 'guard', 'Demo fixture · private fixture transport neutralised, heuristics still live');
  }

  const [dnsResult, tlsResult, fetchResult] = await Promise.all([
    fixture
      ? Promise.resolve({
          info: {
            host: urlFacts.host,
            a: [],
            aaaa: [],
            ns: [],
            mx: [],
            txt: [],
            cname: [],
            spf: null,
            dmarc: null,
            resolves: true,
            skipped: true,
            error: 'Demo fixture: DNS neutralised so the local page can be examined safely.',
          } satisfies DnsInfo,
          indicators: [],
          trustSignals: [],
        })
      : inspectDns(urlFacts.host, urlFacts.registrable),
    fixture
      ? Promise.resolve({
          info: { checked: false, skippedReason: 'Demo fixture: transport signals neutralised.' } satisfies TlsInfo,
          indicators: [],
          trustSignals: [],
          check: { status: 'skip' as const, detail: 'Demo fixture · TLS neutralised' },
        })
      : target.protocol === 'https:'
        ? inspectTls(urlFacts.host)
        : Promise.resolve({
            info: { checked: false, skippedReason: 'Target uses plain HTTP.' } satisfies TlsInfo,
            indicators: [],
            trustSignals: [],
            check: { status: 'skip' as const, detail: 'Plain HTTP · no certificate' },
          }),
    fixture
      ? Promise.resolve(null)
      : safeFetch(target.toString()).catch((error) => {
          if (error instanceof SafetyError) throw error;
          return error as Error;
        }),
  ]);

  let finalUrl = fixture ? fixture.displayUrl : target.toString();
  let status = 0;
  let contentType = 'text/html';
  let html = '';
  let fetchError: string | undefined;
  let hops = fixture
    ? (fixture.redirects ?? [{ url: fixture.displayUrl, status: 200 }])
    : [{ url: target.toString(), status: 0 }];

  if (fixture) {
    const fixtureKey = fixture.targetPath.replace('/demo-fixtures/', '');
    html = FIXTURE_PAGES[fixtureKey]?.() ?? '<html><body>Fixture missing.</body></html>';
    status = 200;
    emit('success', 'fetch', `Fixture page loaded · ${(html.length / 1024).toFixed(1)} KB · local only`);
    if (fixture.redirects) emit('warn', 'redirects', `${fixture.redirects.length} hop chain replayed from fixture manifest`);
  } else if (fetchResult instanceof Error) {
    fetchError = fetchResult.message;
    emit('warn', 'fetch', `Page could not be fetched · ${fetchResult.message}`);
  } else if (fetchResult) {
    finalUrl = fetchResult.finalUrl;
    status = fetchResult.status;
    contentType = fetchResult.contentType;
    html = fetchResult.body;
    hops = fetchResult.hops;
    emit(
      'success',
      'fetch',
      `HTTP ${status} · ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB${fetchResult.truncated ? ' · truncated at 1.4 MB' : ''} · ${hops.length} hop${hops.length === 1 ? '' : 's'}`,
    );
  }

  const dnsInfo = dnsResult.info;
  emit(
    dnsInfo.skipped ? 'warn' : dnsInfo.resolves ? 'success' : 'warn',
    'dns',
    dnsInfo.skipped
      ? 'DNS skipped · demo fixture'
      : dnsInfo.resolves
        ? `DNS · ${dnsInfo.a.length} A · ${dnsInfo.aaaa.length} AAAA · ${dnsInfo.ns.length} NS${dnsInfo.spf ? ' · SPF' : ''}${dnsInfo.dmarc ? ' · DMARC' : ''}`
        : `DNS · no address records for ${urlFacts.host}`,
  );

  emit(
    tlsResult.info.checked ? (tlsResult.check.status === 'ok' ? 'success' : 'warn') : 'warn',
    'tls',
    tlsResult.info.checked
      ? `TLS · ${tlsResult.info.authorized ? 'trusted' : 'untrusted'} · ${tlsResult.info.issuer ?? 'unknown issuer'} · ${tlsResult.info.daysLeft ?? '?'} days left`
      : `TLS · ${tlsResult.info.skippedReason ?? 'skipped'}`,
  );

  const content = html
    ? analyzeContent(html, finalUrl, status || 200, contentType)
    : {
        info: {
          fetched: false,
          forms: [],
          passwordFields: 0,
          iframes: 0,
          externalScripts: 0,
          obfuscationHits: 0,
          error: fetchError ?? 'Page not fetched',
        },
        indicators: [
          {
            id: 'content-unreachable',
            category: 'content' as const,
            title: 'Page could not be inspected',
            severity: 'low' as const,
            weight: 4,
            explanation: `The page did not load, so page-level checks were skipped (${fetchError ?? 'unknown error'}). Network failures can be temporary, or the site may block automated visitors.`,
            evidence: fetchError?.slice(0, 120),
            source: 'Page fetch',
          },
        ],
        trustSignals: [],
        title: '',
        text: '',
        links: [] as string[],
      };

  emit(
    'info',
    'content',
    content.info.fetched
      ? `Content · ${content.info.passwordFields} password field${content.info.passwordFields === 1 ? '' : 's'} · ${content.info.forms.length} form${content.info.forms.length === 1 ? '' : 's'} · ${content.info.externalScripts} external script${content.info.externalScripts === 1 ? '' : 's'}`
      : 'Content · page not available',
  );

  let reference: BrandReference | null = fixture?.reference ?? null;
  if (!reference && options.brand && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(options.brand.trim())) {
    const brandHost = options.brand.trim().toLowerCase();
    if (registrableDomain(brandHost) !== urlFacts.registrable) {
      try {
        const brandFetch = await safeFetch(`https://${brandHost}`, { maxRedirects: 2, timeoutMs: 4000, maxBytes: 600_000 });
        const brandContent = analyzeContent(brandFetch.body, brandFetch.finalUrl, brandFetch.status, brandFetch.contentType);
        reference = {
          brand: brandContent.title || brandHost,
          domain: brandHost,
          title: brandContent.title,
          text: brandContent.text,
        };
        emit('success', 'brand', `Reference page loaded from ${brandHost}`);
      } catch (error) {
        emit('warn', 'brand', `Reference page unavailable · ${(error as Error).message}`);
      }
    }
  }

  const brand = analyzeBrand({
    facts: urlFacts,
    title: content.title,
    text: content.text,
    explicitBrand: options.brand,
    reference,
  });

  emit(
    brand.info.brand ? 'info' : 'info',
    'brand',
    brand.info.brand
      ? `Brand · ${brand.info.brand} · domain ${brand.info.domainMatches ? 'matches' : 'does NOT match'}${brand.info.textSimilarity !== undefined ? ` · text overlap ${Math.round(brand.info.textSimilarity * 100)}%` : ''}`
      : 'Brand · no brand claim detected',
  );

  const redirectAnalysis = analyzeRedirects(hops, urlFacts);
  if (!fixture) {
    emit(
      redirectAnalysis.crossDomainHops ? 'warn' : 'success',
      'redirects',
      `${hops.length} hop${hops.length === 1 ? '' : 's'}${redirectAnalysis.crossDomainHops ? ` · ${redirectAnalysis.crossDomainHops} domain change${redirectAnalysis.crossDomainHops === 1 ? '' : 's'}` : ' · direct destination'}`,
    );
  }

  const reputation = await inspectReputation({
    url: finalUrl,
    host: new URL(finalUrl).hostname,
    registrable: registrableDomain(new URL(finalUrl).hostname),
    demo: Boolean(fixture),
  });
  const listedSources = reputation.info.sources.filter((source) => source.listed).map((source) => source.name);
  emit(
    listedSources.length ? 'error' : 'success',
    'reputation',
    listedSources.length
      ? `Reputation · listed by ${listedSources.join(', ')}`
      : `Reputation · ${reputation.info.sources.filter((source) => source.status === 'clear').length} source${reputation.info.sources.filter((source) => source.status === 'clear').length === 1 ? '' : 's'} clear · ${reputation.info.sources.filter((source) => source.status === 'not_configured').length} not configured`,
  );

  const checks: CheckStep[] = [
    { id: 'url', label: 'Link anatomy', status: urlAnalysis.indicators.some((indicator) => indicator.weight >= 20) ? 'warn' : 'ok', detail: `${urlAnalysis.indicators.length} signal(s)` },
    dnsResult.info.skipped
      ? { id: 'dns', label: 'DNS records', status: 'skip' as const, detail: 'Demo fixture' }
      : { id: 'dns', label: 'DNS records', status: dnsInfo.resolves ? ('ok' as const) : ('warn' as const), detail: dnsInfo.resolves ? `${dnsInfo.a.length} A record(s)` : 'No address record' },
    { id: 'tls', label: 'TLS certificate', status: tlsResult.check.status, detail: tlsResult.check.detail },
    {
      id: 'redirects',
      label: 'Redirect chain',
      status: redirectAnalysis.crossDomainHops >= 2 ? ('warn' as const) : ('ok' as const),
      detail: `${hops.length} hop(s), ${redirectAnalysis.crossDomainHops} domain change(s)`,
    },
    {
      id: 'content',
      label: 'Page content',
      status: content.info.fetched ? (content.info.passwordFields ? ('warn' as const) : ('ok' as const)) : ('warn' as const),
      detail: content.info.fetched ? `${content.info.forms.length} form(s), ${content.info.textLength ?? 0} chars` : 'Not fetched',
    },
    {
      id: 'brand',
      label: 'Brand comparison',
      status: brand.info.brand ? (brand.info.domainMatches ? ('ok' as const) : ('warn' as const)) : ('skip' as const),
      detail: brand.info.brand ? `${brand.info.brand} · ${brand.info.domainMatches ? 'domain match' : 'domain mismatch'}` : 'No brand claim',
    },
    {
      id: 'reputation',
      label: 'Reputation sources',
      status: listedSources.length ? ('warn' as const) : ('ok' as const),
      detail: `${reputation.info.sources.filter((source) => source.status !== 'not_configured').length} checked`,
    },
  ];

  const indicators = [
    ...urlAnalysis.indicators,
    ...dnsResult.indicators,
    ...tlsResult.indicators,
    ...content.indicators,
    ...brand.indicators,
    ...redirectAnalysis.indicators,
    ...reputation.indicators,
  ];
  const trustSignals = [
    ...dnsResult.trustSignals,
    ...tlsResult.trustSignals,
    ...content.trustSignals,
    ...brand.trustSignals,
    ...redirectAnalysis.trustSignals,
    ...reputation.trustSignals,
  ];

  const scoring = scoreFinding({
    indicators,
    trustSignals,
    checks,
    brandName: brand.info.brand,
  });

  emit(
    scoring.score >= 50 ? 'warn' : 'success',
    'score',
    `Risk ${scoring.score}/100 · ${scoring.verdict} · ${indicators.length} indicator${indicators.length === 1 ? '' : 's'} · confidence ${scoring.confidence}%`,
  );

  const durationMs = Date.now() - started;
  emit('success', 'done', `Report ready in ${(durationMs / 1000).toFixed(2)}s · exports available`);

  return {
    id,
    inputUrl,
    host: urlFacts.host,
    registrableDomain: urlFacts.registrable,
    finalUrl,
    scannedAt: new Date().toISOString(),
    durationMs,
    verdict: scoring.verdict,
    score: scoring.score,
    confidence: scoring.confidence,
    summary: scoring.summary,
    reasons: scoring.reasons,
    indicators,
    trustSignals,
    checks,
    categories: scoring.categories,
    redirects: hops,
    dns: dnsInfo,
    tls: tlsResult.info,
    content: content.info,
    brand: brand.info,
    reputation: reputation.info,
    logs,
    demo: fixture
      ? {
          caseId: fixture.id,
          label: fixture.label,
          note: 'Local demo fixture. DNS, TLS and reputation transport checks are neutralised; URL, content, brand and scoring logic still run.',
        }
      : undefined,
    limitations: LIMITATIONS,
  };
}

export async function preflightHost(host: string): Promise<boolean> {
  try {
    const addresses = await dns.lookup(host, { all: true });
    return addresses.every((entry) => isPublicIp(entry.address));
  } catch {
    return false;
  }
}

export type { DemoCase };
