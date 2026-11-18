import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export const SITE_URL = (process.env.VITE_SITE_URL || 'https://bluehats-scanner.vercel.app').replace(/\/$/, '');
export const SITE_NAME = 'BlueHats Scanner';

export const ROUTES = [
  {
    path: '/',
    file: 'index.html',
    title: 'BlueHats Scanner — Phishing & Brand Impersonation Detection',
    description:
      'Paste a link. BlueHats reads its URL, DNS, TLS certificate, redirects and page content, then explains in plain English why it may be a phishing or brand-impersonation scam. Free, explainable, exportable.',
    heading: 'See the trick behind the link.',
    lede: 'An explainable phishing and brand-impersonation scanner. Real DNS, TLS, redirect and page-content checks, with evidence you can read and export.',
    inSitemap: true,
  },
  {
    path: '/demo',
    file: 'demo/index.html',
    title: 'Phishing demo scans — six controlled examples · BlueHats Scanner',
    description:
      'Run six safe, controlled phishing examples: typosquatting, homoglyph domains, redirect chains, cloned brands, parked pages, and credential lures. No live malicious site is involved.',
    heading: 'Six scams, safely under glass.',
    lede: 'Controlled demo fixtures for typosquatting, homoglyphs, redirect chains, cloned brands, parked domains, and credential lures. Nothing leaves the workbench.',
    inSitemap: true,
  },
  {
    path: '/how-to',
    file: 'how-to/index.html',
    title: 'How it works — the BlueHats scanning method',
    description:
      'A transparent walkthrough of the BlueHats scanner: URL anatomy, DNS, TLS, redirects, page content, brand similarity, and reputation feeds, plus how weights become a 0–100 risk score.',
    heading: 'No black box. A checklist with receipts.',
    lede: 'Eight ordered passes, weighted evidence, and a small trust relief. The verdict is the sum — visible, ordered, and exportable.',
    inSitemap: true,
  },
  {
    path: '/docs',
    file: 'docs/index.html',
    title: 'Trust, data & security — BlueHats Scanner',
    description:
      'How BlueHats handles data, which reputation sources it queries, how the SSRF guard works, the JSON API, and the honest limitations of heuristic phishing detection.',
    heading: 'The boring details, on purpose.',
    lede: 'What gets fetched, what gets stored, which feeds are consulted, and what the score cannot prove. If a claim is not supported by the code, it is not on this page.',
    inSitemap: true,
  },
  {
    path: '/history',
    file: 'history/index.html',
    title: 'Your local scan history — BlueHats Scanner',
    description:
      'Review recent scans saved in this browser and reports you submitted for human review. History is local to your device and can be cleared at any time.',
    heading: 'Your recent links, kept local.',
    lede: 'Review recent scans and reports saved in this browser. Nothing on this page is uploaded. Clear it whenever you like.',
    inSitemap: false,
    noindex: true,
  },
  {
    path: '/404',
    file: '404.html',
    title: 'Page not found — BlueHats Scanner',
    description: 'That page is not on the workbench. Head back to the scanner and paste a link.',
    heading: 'That link leads nowhere.',
    lede: 'The page you asked for does not exist. The scanner still works — go back and paste a link.',
    inSitemap: false,
    noindex: true,
    bareFile: true,
  },
];

export const version = pkg.version;

export function canonical(routePath) {
  return `${SITE_URL}${routePath === '/' ? '/' : routePath.replace(/\/$/, '')}`;
}

export function shellMarkup(route) {
  return `<main style="max-width:760px;margin:0 auto;padding:44px 24px 56px;font-family:Outfit,ui-sans-serif,system-ui,sans-serif;color:#2f2118;line-height:1.55">
  <p style="margin:0 0 26px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0f4c48">BlueHats Scanner · explainable link triage</p>
  <h1 style="margin:0 0 16px;font-size:clamp(2.2rem,7vw,4rem);line-height:1;letter-spacing:-.04em">${route.heading}</h1>
  <p style="max-width:62ch;margin:0 0 24px;font-size:1.04rem;color:#725340">${route.lede}</p>
  <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#8b6d57">Loading the workbench… If JavaScript stays off, <a href="/how-to" style="color:#0f4c48">read the method</a> or <a href="/docs" style="color:#0f4c48">view the data and security notes</a>.</p>
</main>`;
}

export function outputFile(route) {
  return path.resolve(process.cwd(), 'dist', route.file);
}
