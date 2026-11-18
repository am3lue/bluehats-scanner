import type { Indicator, RedirectHop, TrustSignal } from '../types.js';
import type { UrlFacts } from './url.js';
import { isIpHost, isPublicIp, registrableDomain } from './utils.js';

export function analyzeRedirects(
  hops: RedirectHop[],
  facts: UrlFacts,
): { indicators: Indicator[]; trustSignals: TrustSignal[]; crossDomainHops: number } {
  const indicators: Indicator[] = [];
  const trustSignals: TrustSignal[] = [];
  const domains = hops.map((hop) => registrableDomain(new URL(hop.url).hostname) ?? new URL(hop.url).hostname);
  const uniqueDomains = new Set(domains);
  const crossDomainHops = Math.max(0, uniqueDomains.size - 1);

  if (hops.length <= 1) {
    trustSignals.push({
      id: 'redirects-direct',
      title: 'No redirect chain',
      explanation: 'The link resolved directly to its destination — nothing was hidden behind intermediate hops.',
      relief: 2,
      source: 'Redirects',
    });
    return { indicators, trustSignals, crossDomainHops };
  }

  if (crossDomainHops >= 1) {
    indicators.push({
      id: 'redirects-cross-domain',
      category: 'redirects',
      title: 'Redirect hops between unrelated domains',
      severity: crossDomainHops >= 2 ? 'medium' : 'low',
      weight: Math.min(8 + crossDomainHops * 5, 20),
      explanation: `The link passes through ${uniqueDomains.size} registrable domains before landing. Cross-domain redirects are normal for link shorteners and ad networks, but also for cloaking that hides the final phishing page from scanners.`,
      evidence: [...uniqueDomains].slice(0, 5).join(' → '),
      source: 'Redirects',
    });
  }

  const final = hops[hops.length - 1];
  let finalHost = '';
  try {
    finalHost = new URL(final.url).hostname;
  } catch {
    /* noop */
  }

  if (finalHost && isIpHost(finalHost) && !isPublicIp(finalHost)) {
    indicators.push({
      id: 'redirects-private',
      category: 'redirects',
      title: 'Redirect chain ends on a private address',
      severity: 'critical',
      weight: 40,
      explanation: 'The chain tried to reach a private or reserved address. BlueHats stopped following it — this is a classic SSRF or internal-network lure.',
      evidence: finalHost,
      source: 'Redirects',
    });
  } else if (finalHost && isIpHost(finalHost)) {
    indicators.push({
      id: 'redirects-ip',
      category: 'redirects',
      title: 'Redirect chain ends on a raw IP address',
      severity: 'high',
      weight: 20,
      explanation: 'The final destination is an IP address rather than a domain. That is unusual for a legitimate brand and common for disposable phishing infrastructure.',
      evidence: finalHost,
      source: 'Redirects',
    });
  }

  if (facts.isShortener) {
    const finalDomain = registrableDomain(finalHost);
    const inputDomain = new URL(hops[0].url).hostname;
    if (finalDomain && registrableDomain(inputDomain) !== finalDomain) {
      indicators.push({
        id: 'redirects-shortener-destination',
        category: 'redirects',
        title: 'Short link leads to a different domain',
        severity: 'low',
        weight: 5,
        explanation: `The shortener hides that the link ends at "${finalDomain}". That does not make it malicious by itself, but it means the visible link was not the real destination.`,
        evidence: `${inputDomain} → ${finalDomain}`,
        source: 'Redirects',
      });
    }
  }

  if (hops.length > 3) {
    indicators.push({
      id: 'redirects-long-chain',
      category: 'redirects',
      title: 'Long redirect chain',
      severity: 'low',
      weight: 5,
      explanation: `The link took ${hops.length} hops to resolve. Long chains make it harder to see where a click really ends up.`,
      evidence: `${hops.length} hops`,
      source: 'Redirects',
    });
  }

  return { indicators, trustSignals, crossDomainHops };
}
