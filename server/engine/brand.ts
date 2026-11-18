import type { BrandInfo, Indicator, TrustSignal } from '../types.js';
import { BRANDS, detectBrandsInText, type BrandEntry } from './brands.js';
import { jaccard, levenshtein, similarity, tokenSet } from './utils.js';
import type { UrlFacts } from './url.js';

export interface BrandReference {
  brand: string;
  domain: string;
  title: string;
  text: string;
}

export function analyzeBrand(options: {
  facts: UrlFacts;
  title: string;
  text: string;
  explicitBrand?: string;
  reference?: BrandReference | null;
}): { info: BrandInfo; indicators: Indicator[]; trustSignals: TrustSignal[] } {
  const { facts, title, text, explicitBrand, reference } = options;
  const pageText = `${title}\n${text}`;
  const detected = detectBrandsInText(pageText);
  let brandEntry: BrandEntry | undefined;
  let brandName: string | undefined;
  let expectedDomain: string | undefined;
  let detectedFrom: BrandInfo['detectedFrom'] = 'none';

  if (explicitBrand) {
    const clean = explicitBrand.trim();
    const lower = clean.toLowerCase();
    const known = BRANDS.find(
      (brand) =>
        brand.name.toLowerCase() === lower ||
        brand.tokens.includes(lower) ||
        brand.domains.some((domain) => domain === lower || lower.endsWith(`.${domain}`)),
    );
    if (known) {
      brandEntry = known;
      brandName = known.name;
      expectedDomain = known.domains[0];
    } else {
      brandName = clean.replace(/^https?:\/\//, '').split('/')[0];
      expectedDomain = brandName.includes('.') ? brandName : undefined;
    }
    detectedFrom = 'user';
  } else if (reference) {
    brandName = reference.brand;
    expectedDomain = reference.domain;
    detectedFrom = 'user';
  } else if (detected) {
    brandEntry = detected.brand;
    brandName = detected.brand.name;
    expectedDomain = detected.brand.domains[0];
    detectedFrom = 'content';
  } else if (facts.hostBrandToken) {
    brandEntry = facts.hostBrandToken;
    brandName = facts.hostBrandToken.name;
    expectedDomain = facts.hostBrandToken.domains[0];
    detectedFrom = 'domain';
  } else if (facts.officialBrand) {
    brandEntry = facts.officialBrand;
    brandName = facts.officialBrand.name;
    expectedDomain = facts.officialBrand.domains[0];
    detectedFrom = 'domain';
  }

  const actualDomain = facts.registrable ?? facts.host;
  let domainMatches: boolean | undefined;
  if (brandName) {
    if (brandEntry) {
      domainMatches = brandEntry.domains.includes(actualDomain) || brandEntry.domains.some((domain) => domain.split('.')[0] === facts.baseLabel);
    } else if (expectedDomain) {
      domainMatches = actualDomain === expectedDomain;
    }
  }

  const indicators: Indicator[] = [];
  const trustSignals: TrustSignal[] = [];
  const mentionCount = brandName
    ? Math.max(
        pageText.toLowerCase().split(brandName.toLowerCase()).length - 1,
        brandEntry ? brandEntry.tokens.reduce((total, token) => total + Number(facts.host.includes(token)), 0) : 0,
      )
    : 0;

  let titleSimilarity: number | undefined;
  let textSimilarity: number | undefined;

  if (reference) {
    titleSimilarity = similarity(normalize(title), normalize(reference.title));
    textSimilarity = jaccard(tokenSet(text), tokenSet(reference.text));
  }

  if (brandName && domainMatches === false) {
    const severity = mentionCount > 0 ? 'high' : 'medium';
    indicators.push({
      id: 'brand-domain-mismatch',
      category: 'brand',
      title: `${brandName} branding on a domain it does not control`,
      severity,
      weight: mentionCount > 0 ? 24 : 12,
      explanation: `The page uses the name "${brandName}"${mentionCount ? ` (${mentionCount} mention${mentionCount === 1 ? '' : 's'})` : ''}, but the domain is "${actualDomain}" instead of ${expectedDomain ?? 'the brand’s own domain'}. That combination is the core of brand-impersonation phishing.`,
      evidence: `${actualDomain} ≠ ${expectedDomain ?? 'expected brand domain'}`,
      source: 'Brand comparison',
    });
  } else if (brandName && domainMatches) {
    trustSignals.push({
      id: 'brand-domain-match',
      title: 'Brand name and domain agree',
      explanation: `"${brandName}" appears on "${actualDomain}", which matches the brand's expected domain.`,
      relief: 8,
      source: 'Brand comparison',
    });
  }

  if (reference && textSimilarity !== undefined && titleSimilarity !== undefined) {
    if (textSimilarity > 0.35 && domainMatches === false) {
      indicators.push({
        id: 'brand-clone-content',
        category: 'brand',
        title: 'Page content closely copies the reference brand',
        severity: 'high',
        weight: 16,
        explanation: `The visible text overlaps ${Math.round(textSimilarity * 100)}% with the legitimate reference page, but the domain does not belong to the brand. That is a strong clone pattern.`,
        evidence: `text overlap ${Math.round(textSimilarity * 100)}% · title similarity ${Math.round(titleSimilarity * 100)}%`,
        source: 'Brand comparison',
      });
    } else if (textSimilarity < 0.12 && mentionCount > 0) {
      indicators.push({
        id: 'brand-reference-mismatch',
        category: 'brand',
        title: 'Page does not resemble the reference brand',
        severity: 'low',
        weight: 6,
        explanation: `The brand name appears, but the page text overlaps only ${Math.round(textSimilarity * 100)}% with the reference page. Either this is a different part of the site, or the brand name is being borrowed.`,
        evidence: `text overlap ${Math.round(textSimilarity * 100)}%`,
        source: 'Brand comparison',
      });
    }
    if (textSimilarity > 0.35 && domainMatches) {
      trustSignals.push({
        id: 'brand-reference-match',
        title: 'Content resembles the reference page',
        explanation: `The page text overlaps ${Math.round(textSimilarity * 100)}% with the supplied reference and the domain matches the brand.`,
        relief: 5,
        source: 'Brand comparison',
      });
    }
  }

  if (brandEntry && facts.brandTypos.length && facts.brandTypos[0].brand.name === brandEntry.name) {
    trustSignals.push({
      id: 'brand-typo-detected',
      title: 'Look-alike domain already flagged',
      explanation: 'The URL engine already recorded this domain as a near-copy of the brand, so it is not counted twice here.',
      relief: 0,
      source: 'Brand comparison',
    });
  }

  const info: BrandInfo = {
    brand: brandName,
    expectedDomain,
    actualDomain,
    domainMatches,
    domainDistance: brandEntry ? levenshtein(actualDomain.split('.')[0], brandEntry.tokens[0]) : undefined,
    titleSimilarity,
    textSimilarity,
    mentionCount,
    detectedFrom,
    referenceUsed: reference?.domain,
  };

  return { info, indicators, trustSignals };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
