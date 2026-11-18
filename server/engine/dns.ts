import dns from 'node:dns/promises';
import type { DnsInfo, Indicator, TrustSignal } from '../types.js';
import { isIpHost } from './utils.js';

const EMPTY_DNS: DnsInfo = {
  host: '',
  a: [],
  aaaa: [],
  ns: [],
  mx: [],
  txt: [],
  cname: [],
  spf: null,
  dmarc: null,
  resolves: false,
};

function withTimeout<T>(promise: Promise<T>, ms = 3500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timed out')), ms)),
  ]);
}

async function safe<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await withTimeout(action());
  } catch {
    return null;
  }
}

export async function inspectDns(host: string, registrable: string | null): Promise<{ info: DnsInfo; indicators: Indicator[]; trustSignals: TrustSignal[] }> {
  if (isIpHost(host)) {
    return {
      info: { ...EMPTY_DNS, host, resolves: true, error: 'Literal IP address — DNS lookup skipped.' },
      indicators: [],
      trustSignals: [],
    };
  }

  const [a, aaaa, ns, mx, txt, cname] = await Promise.all([
    safe(() => dns.resolve4(host)),
    safe(() => dns.resolve6(host)),
    safe(() => dns.resolveNs(registrable ?? host)),
    safe(() => dns.resolveMx(registrable ?? host)),
    safe(() => dns.resolveTxt(registrable ?? host)),
    safe(() => dns.resolveCname(host)),
  ]);

  const txtFlat = (txt ?? []).map((chunks) => chunks.join(''));
  const spf = txtFlat.find((record) => record.toLowerCase().startsWith('v=spf1')) ?? null;
  let dmarc: string | null = null;
  if (registrable) {
    const dmarcRecords = await safe(() => dns.resolveTxt(`_dmarc.${registrable}`));
    dmarc = (dmarcRecords ?? []).map((chunks) => chunks.join('')).find((record) => record.toLowerCase().startsWith('v=dmarc1')) ?? null;
  }

  const resolves = Boolean((a && a.length) || (aaaa && aaaa.length) || (cname && cname.length));
  const info: DnsInfo = {
    host,
    a: a ?? [],
    aaaa: aaaa ?? [],
    ns: ns ?? [],
    mx: (mx ?? []).map((record) => `${record.priority} ${record.exchange}`),
    txt: txtFlat,
    cname: cname ?? [],
    spf,
    dmarc,
    resolves,
  };

  const indicators: Indicator[] = [];
  const trustSignals: TrustSignal[] = [];

  if (!resolves) {
    indicators.push({
      id: 'dns-nxdomain',
      category: 'dns',
      title: 'Domain does not resolve',
      severity: 'medium',
      weight: 10,
      explanation:
        'No A, AAAA or CNAME record answered. The domain may be dead, may be blocked, or may only exist for a short-lived phishing campaign.',
      evidence: host,
      source: 'DNS',
    });
  } else {
    trustSignals.push({
      id: 'dns-resolves',
      title: 'Domain resolves publicly',
      explanation: `DNS answered for ${host}. A live domain is expected for any working site, good or bad.`,
      relief: 0,
      source: 'DNS',
    });
  }

  if (resolves && !mx?.length) {
    indicators.push({
      id: 'dns-no-mx',
      category: 'dns',
      title: 'No mail records on this domain',
      severity: 'info',
      weight: 2,
      explanation:
        'The domain cannot receive email. Phishing kits often use a domain that exists only for a web page, but plenty of legitimate sites also skip MX.',
      evidence: 'MX: none',
      source: 'DNS',
    });
  }

  if (spf && dmarc) {
    trustSignals.push({
      id: 'dns-email-auth',
      title: 'Domain publishes SPF and DMARC',
      explanation: 'The domain has basic email-authentication records. That suggests an organised owner, though scammers can set these up too.',
      relief: 3,
      source: 'DNS',
    });
  }

  return { info, indicators, trustSignals };
}
