import { parse as parseDomain } from 'tldts';
import { BRANDS, LURE_WORDS, SHORTENERS, SUSPICIOUS_TLDS, normalizeLeet, type BrandEntry } from './brands.js';
import { isIpHost, levenshtein } from './utils.js';
import type { Indicator } from '../types.js';

export interface UrlFacts {
  host: string;
  registrable: string | null;
  baseLabel: string | null;
  suffix: string | null;
  isIp: boolean;
  isShortener: boolean;
  isPunycode: boolean;
  hasNonAscii: boolean;
  suspiciousTld: boolean;
  lureHits: string[];
  length: number;
  subdomainDepth: number;
  hyphens: number;
  digits: number;
  brandTypos: { brand: BrandEntry; distance: number; variant: string }[];
  officialBrand: BrandEntry | null;
  hostBrandToken: BrandEntry | null;
}

function baseLabelOf(domain: string | null): string | null {
  if (!domain) return null;
  return domain.split('.')[0] ?? null;
}

export function analyzeUrl(url: URL): { facts: UrlFacts; indicators: Indicator[] } {
  const parsed = parseDomain(url.hostname, { allowPrivateDomains: true });
  const registrable = parsed.domain ?? null;
  const baseLabel = baseLabelOf(registrable);
  const suffix = parsed.publicSuffix ?? null;
  const host = url.hostname.toLowerCase();
  const indicators: Indicator[] = [];
  const hostWithoutTld = host.replace(new RegExp(`\\.?${suffix ?? ''}$`), '');
  const path = decodeURIComponentSafe(url.pathname + url.search);

  const isIp = isIpHost(host);
  const isPunycode = host.includes('xn--');
  const hasNonAscii = [...host].some((character) => character.charCodeAt(0) > 127);
  const suspiciousTld = suffix ? SUSPICIOUS_TLDS.has(suffix.split('.').pop() ?? '') : false;
  const isShortener = SHORTENERS.has(registrable ?? host);
  const lureHits = LURE_WORDS.filter((word) => host.includes(word) || path.toLowerCase().includes(word));

  let officialBrand: BrandEntry | null = null;
  let hostBrandToken: BrandEntry | null = null;
  const brandTypos: { brand: BrandEntry; distance: number; variant: string }[] = [];

  for (const brand of BRANDS) {
    if (brand.domains.includes(registrable ?? '')) {
      officialBrand = brand;
      continue;
    }
    const brandBases = brand.domains.map((domain) => domain.split('.')[0]);
    if (baseLabel && brandBases.includes(baseLabel)) {
      officialBrand = brand;
      continue;
    }
    for (const token of brand.tokens) {
      if (token.length < 4) continue;
      if (hostWithoutTld.includes(token) && !hostWithoutTld.startsWith(token)) {
        hostBrandToken ??= brand;
      }
      if (baseLabel) {
        const normalized = normalizeLeet(baseLabel.replace(/-/g, ''));
        const target = normalizeLeet(token);
        if (normalized === target && baseLabel !== token) {
          brandTypos.push({ brand, distance: 0, variant: 'look-alike characters' });
          break;
        }
        if (Math.abs(baseLabel.length - token.length) <= 2 && baseLabel.length > 4) {
          const distance = levenshtein(baseLabel.replace(/-/g, ''), token);
          if (distance > 0 && distance <= 2) {
            brandTypos.push({ brand, distance, variant: `${distance} character edit` });
            break;
          }
        }
      }
    }
  }

  if (url.protocol === 'http:') {
    indicators.push({
      id: 'url-http',
      category: 'url',
      title: 'Connection is not encrypted',
      severity: 'medium',
      weight: 6,
      explanation:
        'The link uses plain HTTP. Anything you type on the page can be read or modified in transit, and modern services almost always use HTTPS.',
      evidence: url.protocol,
    });
  }

  if (isIp) {
    indicators.push({
      id: 'url-ip-host',
      category: 'url',
      title: 'Numeric IP address instead of a domain',
      severity: 'high',
      weight: 30,
      explanation:
        'Legitimate brands publish a domain name, not a raw IP address. Phishing kits and throwaway hosts often skip the domain entirely.',
      evidence: host,
    });
  }

  if (isPunycode || hasNonAscii) {
    indicators.push({
      id: 'url-homoglyph',
      category: 'url',
      title: 'Domain uses look-alike (punycode) characters',
      severity: 'high',
      weight: 26,
      explanation:
        'The hostname contains internationalised characters or punycode. Attackers use letters from other alphabets that look identical to Latin letters to fake a brand.',
      evidence: host,
    });
  }

  const typo = brandTypos[0];
  if (typo) {
    indicators.push({
      id: 'url-typosquat',
      category: 'url',
      title: `Domain mimics ${typo.brand.name}`,
      severity: 'critical',
      weight: 30,
      explanation: `The registrable domain "${registrable}" is a near-copy of ${typo.brand.name} (${typo.brand.domains[0]}) — ${typo.variant}. Typosquat domains are the most common phishing delivery trick.`,
      evidence: `${host} ≈ ${typo.brand.domains[0]}`,
    });
  }

  if (hostBrandToken && !officialBrand) {
    indicators.push({
      id: 'url-brand-subdomain',
      category: 'url',
      title: `${hostBrandToken.name} name used in a domain it does not own`,
      severity: 'high',
      weight: 22,
      explanation: `${hostBrandToken.name} appears in the subdomain, but the registrable domain is "${registrable}". Brands usually keep their name in the domain they control (for example ${hostBrandToken.domains[0]}).`,
      evidence: host,
    });
  }

  if (lureHits.length) {
    const shown = lureHits.slice(0, 4).join(', ');
    indicators.push({
      id: 'url-lure-words',
      category: 'url',
      title: 'Lure words in the link',
      severity: lureHits.length > 2 ? 'medium' : 'low',
      weight: Math.min(4 + lureHits.length * 2, 12),
      explanation: `The URL contains ${shown}. These words are common in fake login, "account locked" and "claim your reward" pages. On their own they are not proof, but they raise the temperature.`,
      evidence: lureHits.join(', '),
    });
  }

  if (suspiciousTld) {
    indicators.push({
      id: 'url-tld',
      category: 'url',
      title: 'Cheap or frequently abused top-level domain',
      severity: 'low',
      weight: 8,
      explanation: `".${suffix}" is cheap or free to register and is over-represented in abuse reports. Plenty of good sites use it too — treat it as one weight, not a verdict.`,
      evidence: `.${suffix}`,
    });
  }

  if (isShortener) {
    indicators.push({
      id: 'url-shortener',
      category: 'url',
      title: 'Shortened link hides its destination',
      severity: 'low',
      weight: 6,
      explanation:
        'The link goes through a URL shortener, so the real destination is not visible until it redirects. BlueHats follows the chain for you, but a shortener alone is not suspicious.',
      evidence: registrable ?? host,
    });
  }

  const subdomainDepth = host.split('.').length - (registrable ? registrable.split('.').length : 1);
  if (subdomainDepth >= 3) {
    indicators.push({
      id: 'url-subdomains',
      category: 'url',
      title: 'Deeply nested subdomains',
      severity: 'low',
      weight: 6,
      explanation:
        'Long chains of subdomains are sometimes used to push the real domain out of sight on small screens and in address bars.',
      evidence: host,
    });
  }

  const hyphens = (baseLabel ?? '').split('-').length - 1;
  if (hyphens >= 2) {
    indicators.push({
      id: 'url-hyphens',
      category: 'url',
      title: 'Hyphen-stacked domain',
      severity: 'low',
      weight: 5,
      explanation:
        'Multiple hyphens are common in look-alike domains because attackers need to squeeze a brand and a lure word into one name.',
      evidence: registrable ?? host,
    });
  }

  if (url.href.length > 160) {
    indicators.push({
      id: 'url-length',
      category: 'url',
      title: 'Unusually long link',
      severity: 'low',
      weight: 4,
      explanation:
        'Very long URLs can bury the real host or the real file name. Long is not automatically bad, but it is worth reading the domain carefully.',
      evidence: `${url.href.length} characters`,
    });
  }

  const encodedRuns = (url.pathname.match(/%[0-9a-f]{2}/gi) ?? []).length;
  if (encodedRuns >= 6) {
    indicators.push({
      id: 'url-encoding',
      category: 'url',
      title: 'Heavy URL encoding in the path',
      severity: 'low',
      weight: 4,
      explanation:
        'The path contains a lot of percent-encoding, which can hide redirect targets or file names from a quick glance.',
      evidence: `${encodedRuns} encoded bytes`,
    });
  }

  if (/\.(exe|scr|apk|msi|bat|cmd|jar|vbs|ps1)(\?|$)/i.test(url.pathname)) {
    indicators.push({
      id: 'url-executable',
      category: 'url',
      title: 'Link points directly at an executable file',
      severity: 'high',
      weight: 18,
      explanation:
        'The URL ends in a file type that runs code on your device. Legitimate services rarely distribute software this way, and phishing pages often do.',
      evidence: url.pathname,
    });
  }

  if ((url.searchParams.toString().match(/https?%3a|https?:\/\//gi) ?? []).length > 0) {
    indicators.push({
      id: 'url-nested-destination',
      category: 'url',
      title: 'Another URL is embedded in the query string',
      severity: 'low',
      weight: 5,
      explanation:
        'The link carries a second destination inside its query string. This is normal for email click-trackers, but also for open-redirect abuse.',
      evidence: 'embedded URL parameter',
    });
  }

  return {
    facts: {
      host,
      registrable,
      baseLabel,
      suffix,
      isIp,
      isShortener,
      isPunycode,
      hasNonAscii,
      suspiciousTld,
      lureHits,
      length: url.href.length,
      subdomainDepth,
      hyphens,
      digits: (baseLabel ?? '').replace(/\D/g, '').length,
      brandTypos,
      officialBrand,
      hostBrandToken,
    },
    indicators,
  };
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
