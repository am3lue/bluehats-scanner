import * as cheerio from 'cheerio';
import type { ContentInfo, FormInfo, Indicator, TrustSignal } from '../types.js';
import { registrableDomain } from './utils.js';

export interface ContentAnalysis {
  info: ContentInfo;
  indicators: Indicator[];
  trustSignals: TrustSignal[];
  title: string;
  text: string;
  links: string[];
}

const EMPTY: ContentInfo = {
  fetched: false,
  forms: [],
  passwordFields: 0,
  iframes: 0,
  externalScripts: 0,
  obfuscationHits: 0,
};

export function analyzeContent(html: string, finalUrl: string, status: number, contentType: string): ContentAnalysis {
  const indicators: Indicator[] = [];
  const trustSignals: TrustSignal[] = [];

  if (!/html|xml|text\/plain/i.test(contentType) && !html.trim().startsWith('<')) {
    return {
      info: { ...EMPTY, fetched: true, status, finalUrl, error: `Unsupported content type: ${contentType || 'unknown'}` },
      indicators: [
        {
          id: 'content-not-html',
          category: 'content',
          title: 'The link does not return a web page',
          severity: 'low',
          weight: 3,
          explanation: `The server returned "${contentType || 'an unknown type'}" instead of HTML. It may be a file download or an API endpoint.`,
          evidence: contentType || 'no content-type',
          source: 'Page fetch',
        },
      ],
      trustSignals,
      title: '',
      text: '',
      links: [],
    };
  }

  const $ = cheerio.load(html);
  const title = ($('title').first().text() || '').trim().slice(0, 300);
  const description = ($('meta[name="description"]').attr('content') || '').trim().slice(0, 400);
  const pageDomain = registrableDomain(new URL(finalUrl).hostname);

  const forms: FormInfo[] = [];
  $('form').each((_, element) => {
    const form = $(element);
    const action = form.attr('action') || '';
    let resolvedAction = finalUrl;
    try {
      resolvedAction = new URL(action || finalUrl, finalUrl).toString();
    } catch {
      /* keep finalUrl */
    }
    const actionDomain = registrableDomain(new URL(resolvedAction).hostname);
    forms.push({
      action,
      resolvedAction,
      method: (form.attr('method') || 'get').toUpperCase(),
      hasPassword: form.find('input[type="password"]').length > 0,
      crossOrigin: Boolean(actionDomain && pageDomain && actionDomain !== pageDomain),
    });
  });

  const passwordFields = $('input[type="password"]').length;
  const iframes = $('iframe').length;
  const hiddenIframes = $('iframe').filter((_, element) => {
    const el = $(element);
    const style = (el.attr('style') || '').toLowerCase().replace(/\s/g, '');
    return el.attr('hidden') !== undefined || style.includes('display:none') || style.includes('width:0') || style.includes('height:0');
  }).length;

  let externalScripts = 0;
  let obfuscationHits = 0;
  const scriptDomains = new Set<string>();
  $('script').each((_, element) => {
    const script = $(element);
    const src = script.attr('src');
    if (src) {
      externalScripts++;
      try {
        scriptDomains.add(registrableDomain(new URL(src, finalUrl).hostname) ?? '');
      } catch {
        /* noop */
      }
      return;
    }
    const code = script.text();
    if (!code) return;
    if (/\beval\s*\(|\batob\s*\(|\bunescape\s*\(|String\.fromCharCode/i.test(code)) obfuscationHits++;
    if (/[A-Za-z0-9+/]{200,}={0,2}/.test(code)) obfuscationHits++;
  });

  const refresh = $('meta[http-equiv="refresh" i]').attr('content') || '';

  let favicon = $('link[rel~="icon" i]').attr('href') || '';
  try {
    if (favicon) favicon = new URL(favicon, finalUrl).toString();
  } catch {
    favicon = '';
  }

  $('script, style, noscript, svg').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const textSample = text.slice(0, 6000);
  const yearMatch = /(?:©|copyright)\s*(?:20\d{2}\s*[-–]\s*)?(20\d{2})/i.exec(text);
  const copyrightYear = yearMatch ? Number(yearMatch[1]) : undefined;

  const links = $('a')
    .map((_, element) => $(element).attr('href') || '')
    .get()
    .filter(Boolean)
    .slice(0, 40);

  const externalForms = forms.filter((form) => form.crossOrigin);
  const passwordForm = forms.find((form) => form.hasPassword);
  const insecureAction = forms.find((form) => form.hasPassword && form.resolvedAction.startsWith('http:'));

  if (passwordForm) {
    indicators.push({
      id: 'content-password-form',
      category: 'content',
      title: 'Page asks for a password',
      severity: 'info',
      weight: 4,
      explanation: 'The page contains a password field. That is normal for a real sign-in page, but it also means a fake page has something worth stealing.',
      evidence: passwordForm.resolvedAction,
      source: 'Page content',
    });
  }

  if (externalForms.length) {
    indicators.push({
      id: 'content-cross-origin-form',
      category: 'content',
      title: 'Credentials are posted to another domain',
      severity: 'critical',
      weight: 34,
      explanation: `The form sends data to "${registrableDomain(new URL(externalForms[0].resolvedAction).hostname)}" instead of staying on "${pageDomain}". Real sign-in pages submit to their own domain; this is how a cloned login page collects credentials.`,
      evidence: `${pageDomain} → ${registrableDomain(new URL(externalForms[0].resolvedAction).hostname)}`,
      source: 'Page content',
    });
  }

  if (insecureAction) {
    indicators.push({
      id: 'content-insecure-form',
      category: 'content',
      title: 'Login form submits over plain HTTP',
      severity: 'medium',
      weight: 8,
      explanation: 'The form action is not encrypted. Anything typed in would travel in cleartext.',
      evidence: insecureAction.resolvedAction,
      source: 'Page content',
    });
  }

  if (refresh) {
    const refreshUrl = /url\s*=\s*([^;]+)/i.exec(refresh)?.[1]?.trim();
    let external = false;
    if (refreshUrl) {
      try {
        const target = new URL(refreshUrl.replace(/^['"]|['"]$/g, ''), finalUrl);
        const targetDomain = registrableDomain(target.hostname);
        external = Boolean(targetDomain && pageDomain && targetDomain !== pageDomain);
      } catch {
        external = true;
      }
    }
    if (external) {
      indicators.push({
        id: 'content-meta-refresh',
        category: 'content',
        title: 'Page immediately redirects elsewhere',
        severity: 'medium',
        weight: 14,
        explanation: 'A meta refresh sends the browser to another domain. Scammers use this to show a harmless page to scanners and a phishing page to visitors.',
        evidence: refresh.slice(0, 120),
        source: 'Page content',
      });
    }
  }

  if (obfuscationHits) {
    indicators.push({
      id: 'content-obfuscation',
      category: 'content',
      title: 'Obfuscated JavaScript on the page',
      severity: obfuscationHits > 1 ? 'medium' : 'low',
      weight: Math.min(5 + obfuscationHits * 4, 16),
      explanation: `Found ${obfuscationHits} sign${obfuscationHits === 1 ? '' : 's'} of packed or obfuscated script (eval, atob, unescape or long encoded strings). Legitimate sites use bundlers, but this pattern also hides credential-stealing code.`,
      evidence: `${obfuscationHits} obfuscation signal${obfuscationHits === 1 ? '' : 's'}`,
      source: 'Page content',
    });
  }

  if (hiddenIframes) {
    indicators.push({
      id: 'content-hidden-iframe',
      category: 'content',
      title: 'Hidden iframe on the page',
      severity: 'medium',
      weight: 10,
      explanation: 'Hidden iframes are used for clickjacking, silent tracking and loading a second page out of sight.',
      evidence: `${hiddenIframes} hidden iframe${hiddenIframes === 1 ? '' : 's'}`,
      source: 'Page content',
    });
  }

  if (/account (?:has been |is )?(?:suspended|locked)|domain (?:is )?for sale|parked domain|this site can.t be reached|seized/i.test(text)) {
    indicators.push({
      id: 'content-parked',
      category: 'content',
      title: 'Page looks parked, suspended or seized',
      severity: 'medium',
      weight: 12,
      explanation: 'The page text mentions a suspended account, a parked domain or a seizure notice. Scammers reuse expired and hijacked domains, and abandoned pages are a poor place to enter details.',
      evidence: text.slice(0, 140),
      source: 'Page content',
    });
  }

  if (status >= 400) {
    indicators.push({
      id: 'content-http-error',
      category: 'content',
      title: `Server returned HTTP ${status}`,
      severity: 'low',
      weight: 4,
      explanation: 'The page did not load successfully. It may be offline, protected, or already taken down.',
      evidence: `HTTP ${status}`,
      source: 'Page fetch',
    });
  }

  if (passwordFields > 0 && text.length < 160) {
    indicators.push({
      id: 'content-thin-login',
      category: 'content',
      title: 'Almost no content around a login form',
      severity: 'medium',
      weight: 8,
      explanation: 'The page is mostly a bare credential form with very little surrounding text. Cloned login pages are often stripped down like this.',
      evidence: `${text.length} characters of visible text`,
      source: 'Page content',
    });
  }

  if (!passwordFields) {
    trustSignals.push({
      id: 'content-no-password',
      title: 'No password field detected',
      explanation: 'The page does not ask for a password in its HTML, which removes the most direct credential-theft risk.',
      relief: 3,
      source: 'Page content',
    });
  }

  if (text.length > 400) {
    trustSignals.push({
      id: 'content-substantial',
      title: 'Page has substantial visible content',
      explanation: `About ${text.length} characters of visible text were found. Thin clone pages are common, so a fleshed-out page is mildly reassuring.`,
      relief: 2,
      source: 'Page content',
    });
  }

  if (externalScripts === 0) {
    trustSignals.push({
      id: 'content-no-external-scripts',
      title: 'No third-party scripts',
      explanation: 'The page loads no external JavaScript, which reduces the ways it could quietly change after loading.',
      relief: 1,
      source: 'Page content',
    });
  }

  const info: ContentInfo = {
    fetched: true,
    status,
    finalUrl,
    title,
    description,
    textSample,
    textLength: text.length,
    forms,
    passwordFields,
    iframes,
    externalScripts,
    obfuscationHits,
    metaRefresh: refresh || undefined,
    favicon: favicon || undefined,
    copyrightYear,
  };

  return { info, indicators, trustSignals, title, text: textSample, links };
}
