import type {
  CategoryId,
  CategoryScore,
  CheckStep,
  Indicator,
  Severity,
  TrustSignal,
  Verdict,
} from '../types.js';
import { clamp } from './utils.js';

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  url: 'Link anatomy',
  dns: 'DNS & mail',
  tls: 'Certificate',
  redirects: 'Redirects',
  content: 'Page content',
  brand: 'Brand match',
  reputation: 'Reputation',
};

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const LIMITATIONS = [
  'Heuristics produce leads, not proof. A low score does not guarantee a site is safe.',
  'The scanner fetches the page as an anonymous visitor and never executes page scripts, so JavaScript-only cloaking can be missed.',
  'Reputation snapshots can lag behind a brand-new phishing campaign, and blocklists occasionally contain false positives.',
  'Certificate checks confirm who signed a certificate, not who owns the website. Free certificates are available to everyone.',
  'DNS and popularity data are point-in-time observations and can change within minutes.',
  'We never submit forms or enter credentials, so we cannot see what would happen after you sign in.',
];

export function verdictFor(score: number): Verdict {
  if (score >= 75) return 'dangerous';
  if (score >= 50) return 'suspicious';
  if (score >= 25) return 'caution';
  return 'safe';
}

export function scoreFinding(options: {
  indicators: Indicator[];
  trustSignals: TrustSignal[];
  checks: CheckStep[];
  brandName?: string;
}): {
  score: number;
  verdict: Verdict;
  confidence: number;
  summary: string;
  reasons: string[];
  categories: CategoryScore[];
} {
  const { indicators, trustSignals, checks, brandName } = options;
  const raw = indicators.reduce((total, indicator) => total + indicator.weight, 0);
  const relief = Math.min(
    trustSignals.reduce((total, signal) => total + signal.relief, 0),
    15,
  );
  let score = clamp(Math.round(raw - relief), 0, 100);

  const hardIndicators = new Set(
    indicators.filter((indicator) => indicator.severity === 'critical').map((indicator) => indicator.id),
  );
  if (hardIndicators.has('reputation-feed-match') || [...hardIndicators].some((id) => id.startsWith('reputation-'))) {
    score = Math.max(score, 92);
  }
  if (hardIndicators.has('content-cross-origin-form') && indicators.some((indicator) => indicator.id === 'brand-domain-mismatch')) {
    score = Math.max(score, 84);
  }
  if (hardIndicators.has('url-typosquat') && indicators.some((indicator) => indicator.category === 'content' || indicator.category === 'brand')) {
    score = Math.max(score, 78);
  }

  const verdict = verdictFor(score);
  const executed = checks.filter((check) => check.status !== 'skip').length;
  const ratio = checks.length ? executed / checks.length : 0.5;
  const confidence = clamp(
    Math.round(48 + ratio * 38 + (indicators.some((indicator) => indicator.severity === 'critical') ? 8 : 0)),
    35,
    98,
  );

  const sorted = [...indicators].sort((a, b) => b.weight - a.weight);
  const top = sorted.slice(0, 4);
  const reasons = top.map((indicator) => indicator.title);
  const brand = brandName ? ` dressed up as ${brandName}` : '';

  let summary: string;
  if (verdict === 'safe') {
    summary = `Nothing serious surfaced on this scan${
      trustSignals.length ? ` — ${trustSignals[0].title.toLowerCase()}` : ''
    }. Heuristics cannot prove a site is safe, so still read the address before you type a password or pay.`;
  } else if (verdict === 'caution') {
    summary = `A few soft signals are worth a second look: ${top
      .slice(0, 2)
      .map((indicator) => indicator.title.toLowerCase())
      .join('; ')}. None of these proves a scam${brand ? `, but the page${brand}` : ''}, so slow down before entering anything.`;
  } else if (verdict === 'suspicious') {
    summary = `Several indicators line up with impersonation${brand}: ${top
      .slice(0, 3)
      .map((indicator) => indicator.title.toLowerCase())
      .join('; ')}. Treat this link as unsafe until you can verify it through an official app or by typing the address yourself.`;
  } else {
    summary = `This scan matches a phishing pattern${brand}: ${top
      .slice(0, 3)
      .map((indicator) => indicator.title.toLowerCase())
      .join('; ')}. Do not enter credentials or payment details. Close the page and reach the organisation through its official app or website.`;
  }

  const categories: CategoryScore[] = (Object.keys(CATEGORY_LABELS) as CategoryId[]).map((id) => {
    const scoped = indicators.filter((indicator) => indicator.category === id);
    const counts = SEVERITY_ORDER.reduce(
      (accumulator, severity) => {
        accumulator[severity] = scoped.filter((indicator) => indicator.severity === severity).length;
        return accumulator;
      },
      { info: 0, low: 0, medium: 0, high: 0, critical: 0 } as Record<Severity, number>,
    );
    return {
      id,
      label: CATEGORY_LABELS[id],
      score: clamp(scoped.reduce((total, indicator) => total + indicator.weight, 0), 0, 100),
      counts,
    };
  });

  return { score, verdict, confidence, summary, reasons, categories };
}
