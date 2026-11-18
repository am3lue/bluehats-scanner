import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { useSeo } from '../lib/seo';

const TOC = [
  { id: 'method', label: 'The pipeline' },
  { id: 'scoring', label: 'How scoring works' },
  { id: 'bands', label: 'Verdict bands' },
  { id: 'report', label: 'Reading a report' },
  { id: 'demo', label: 'Demo fixtures' },
  { id: 'limits', label: 'Where it stops' },
];

const PIPELINE: { title: string; icon: IconName; body: string; detail: string }[] = [
  {
    title: 'Normalise and guard',
    icon: 'shield',
    body: 'The input is validated, given a scheme if it is missing, and resolved before any request is made.',
    detail:
      'Private, loopback, link-local, and reserved addresses are rejected. The fetch pins the resolved address, caps redirects, bytes, and time, and never executes page JavaScript.',
  },
  {
    title: 'Read the URL anatomy',
    icon: 'link',
    body: 'The address itself leaks intent before a page loads: punycode, raw IPs, shorteners, lure words, and lookalike domains.',
    detail:
      'Checks include homoglyph and punycode hosts, edit distance against known brands, brand names parked in subdomains, cheap TLDs, hyphen stacking, deep nesting, executable paths, and embedded URLs.',
  },
  {
    title: 'Inspect DNS and mail posture',
    icon: 'globe',
    body: 'Public records tell us whether the domain exists, where mail goes, and whether it publishes SPF and DMARC.',
    detail:
      'We collect A, AAAA, NS, MX, TXT, CNAME, SPF, and DMARC. A missing domain or missing mail authentication is a soft signal, not a verdict.',
  },
  {
    title: 'Verify the certificate',
    icon: 'lock',
    body: 'TLS tells us who signed the certificate, whether it matches the hostname, and how old it is.',
    detail:
      'We flag untrusted or self-signed chains, hostname mismatches, expiry, and very young certificates. A valid certificate proves encryption, not honesty — free certificates are available to anyone.',
  },
  {
    title: 'Follow the redirects',
    icon: 'route',
    body: 'Short links and open redirects hide the real destination. We walk the chain and compare domains.',
    detail:
      'Each hop is recorded with its status and location. Cross-domain hops, ending on a raw IP or private address, and long chains all feed the score.',
  },
  {
    title: 'Read the page, carefully',
    icon: 'file',
    body: 'One bounded HTTP fetch, parsed as text. We look at structure and intent, not pixels.',
    detail:
      'Signals include credential forms, cross-origin form actions, password fields, hidden iframes, obfuscated script, meta refresh, parked-page language, thin login pages, and third-party script count.',
  },
  {
    title: 'Compare the brand',
    icon: 'badge',
    body: 'If you name the brand — or the page does — we measure how far the domain and content drift from the real thing.',
    detail:
      'We combine edit distance on the registrable domain, leet and homoglyph normalisation, title and text similarity against a reference page when one is available, and mention counts.',
  },
  {
    title: 'Consult reputation',
    icon: 'database',
    body: 'Public phishing feeds and DNS blocklists catch campaigns that heuristics alone might miss.',
    detail:
      'The local snapshot bundles OpenPhish URLs, CERT Polska domains, and Spam404 entries, refreshed by a script. Live DNSBL queries cover Spamhaus DBL and SURBL, and Tranco supplies popularity context. Optional API keys add Google Safe Browsing, URLhaus, VirusTotal, PhishTank, and Cloudflare Radar.',
  },
];

const BANDS = [
  { range: '0–24', verdict: 'Safe', tone: 'safe', copy: 'No serious signal fired. Still verify the domain before typing a password.' },
  { range: '25–49', verdict: 'Caution', tone: 'caution', copy: 'Soft signals worth a second look. Slow down and confirm through an official channel.' },
  { range: '50–74', verdict: 'Suspicious', tone: 'suspicious', copy: 'Several indicators line up with impersonation. Treat the link as unsafe until verified.' },
  { range: '75–100', verdict: 'Dangerous', tone: 'dangerous', copy: 'Matches a phishing pattern. Do not enter credentials or payment details.' },
];

export function HowToPage() {
  useSeo({
    title: 'How it works — the BlueHats scanning method',
    description:
      'A transparent walkthrough of the BlueHats scanner: URL anatomy, DNS, TLS, redirects, page content, brand similarity, and reputation feeds, plus how weights become a 0–100 risk score.',
    path: '/how-to',
  });

  const [active, setActive] = useState('method');

  useEffect(() => {
    const sections = TOC.map((entry) => document.getElementById(entry.id)).filter((element): element is HTMLElement => Boolean(element));
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: '-24% 0px -62% 0px', threshold: [0, 0.25, 0.6] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="page howto-page">
      <section className="page-hero shell">
        <span className="eyebrow">
          <span className="eyebrow__dot" />
          The method
        </span>
        <h1>No black box. A checklist with receipts.</h1>
        <p className="page-hero__lede">
          BlueHats runs a fixed sequence of checks, assigns each finding a weight, and subtracts a small amount for reassuring
          evidence. The verdict is the sum — visible, ordered, and exportable.
        </p>
        <div className="page-hero__actions">
          <Link to="/" className="btn btn--primary">
            <Icon name="scan" size={17} />
            Try it on a link
          </Link>
          <Link to="/docs" className="btn btn--ghost">
            Read the trust docs
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </section>

      <div className="shell doc-layout">
        <aside className="doc-toc" aria-label="On this page">
          <span className="doc-toc__label">On this page</span>
          {TOC.map((entry) => (
            <a key={entry.id} href={`#${entry.id}`} className={active === entry.id ? 'is-active' : ''}>
              {entry.label}
            </a>
          ))}
          <div className="doc-toc__card">
            <Icon name="shield" size={18} />
            <p>Heuristics produce leads, not proof. The scanner never logs in, submits forms, or executes scripts.</p>
          </div>
        </aside>

        <article className="doc-body">
          <section id="method" className="doc-section">
            <span className="eyebrow eyebrow--muted">01 · The pipeline</span>
            <h2>Eight passes, in order</h2>
            <p>
              Checks that are cheap and decisive run first. Anything that requires a network request is guarded and capped. If a
              step cannot run, it is marked as skipped rather than silently treated as clean — and that lowers confidence.
            </p>
            <ol className="pipeline">
              {PIPELINE.map((step, index) => (
                <li key={step.title} className="pipeline__item">
                  <div className="pipeline__marker">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span className="pipeline__line" aria-hidden="true" />
                  </div>
                  <div className="pipeline__content">
                    <div className="pipeline__title">
                      <span className="pipeline__icon">
                        <Icon name={step.icon} size={18} />
                      </span>
                      <h3>{step.title}</h3>
                    </div>
                    <p>{step.body}</p>
                    <p className="pipeline__detail">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="scoring" className="doc-section">
            <span className="eyebrow eyebrow--muted">02 · Scoring</span>
            <h2>Weights add up. Relief is capped.</h2>
            <p>
              Every fired signal carries a weight from 2 to 55. Critical findings are rare and heavy. Reassuring signals subtract a
              little, but never more than 15 points in total, so a clean certificate cannot erase a phishing-feed match.
            </p>
            <div className="formula-grid">
              <div className="formula-card">
                <span className="formula-card__label">Base score</span>
                <code>sum(weights) − min(relief, 15)</code>
                <p>Clamped to 0–100 and rounded. A safe-looking page can still score low without proving anything.</p>
              </div>
              <div className="formula-card">
                <span className="formula-card__label">Escalation floors</span>
                <code>feed match → ≥ 92</code>
                <p>Critical combinations are pinned: a phishing-feed listing, cross-origin credentials plus brand mismatch (≥ 84), or a typosquat with content/brand evidence (≥ 78).</p>
              </div>
              <div className="formula-card">
                <span className="formula-card__label">Confidence</span>
                <code>48 + (executed / total) × 38 + critical bonus</code>
                <p>Clamped to 35–98. Skipped network steps pull confidence down and are named in the report.</p>
              </div>
              <div className="formula-card">
                <span className="formula-card__label">Family scores</span>
                <code>sum(weights within a family)</code>
                <p>Each of the seven families gets its own 0–100 bar so you can see where the pressure came from.</p>
              </div>
            </div>
            <div className="callout callout--note">
              <Icon name="info" size={18} />
              <p>
                Family bars are diagnostic, not additive. The overall score is computed from individual signal weights, not by
                averaging the seven bars.
              </p>
            </div>
          </section>

          <section id="bands" className="doc-section">
            <span className="eyebrow eyebrow--muted">03 · Verdicts</span>
            <h2>Four bands, deliberately conservative</h2>
            <div className="band-table">
              {BANDS.map((band) => (
                <div key={band.range} className={`band band--${band.tone}`}>
                  <span className="band__range">{band.range}</span>
                  <strong>{band.verdict}</strong>
                  <span>{band.copy}</span>
                </div>
              ))}
            </div>
            <p>
              The thresholds are fixed in the engine: safe below 25, caution from 25, suspicious from 50, dangerous from 75. A
              single critical signal can push a page across multiple bands, which is intentional.
            </p>
          </section>

          <section id="report" className="doc-section">
            <span className="eyebrow eyebrow--muted">04 · Reading the report</span>
            <h2>Start with the reasons, then check the receipts</h2>
            <ol className="checklist">
              <li>
                <strong>Read “Why this verdict”.</strong> The four heaviest signals are listed first, in plain language.
              </li>
              <li>
                <strong>Open “Signals &amp; evidence”.</strong> Each finding shows its weight, severity, evidence string, and source.
              </li>
              <li>
                <strong>Look at the redirect chain.</strong> A short link that lands on a raw IP or a different registrable domain is a
                red flag regardless of the final page.
              </li>
              <li>
                <strong>Check the sources table.</strong> “Unavailable” and “No API key” are not the same as “clear”; the report tells you
                which checks actually ran.
              </li>
              <li>
                <strong>Export what you need.</strong> JSON for a ticket, CSV for a timeline, PDF for a human who will not read JSON.
              </li>
            </ol>
          </section>

          <section id="demo" className="doc-section">
            <span className="eyebrow eyebrow--muted">05 · Demo fixtures</span>
            <h2>Predictable inputs make honest demos</h2>
            <p>
              The six fixtures replace network transport with local data: a deterministic HTML page, redirect manifest, DNS and TLS
              facts, and feed entries. The same scoring code runs, so the output is reproducible. Persona hostnames use reserved
              example domains and never point at real infrastructure.
            </p>
            <Link to="/demo" className="text-link">
              Open the demo library
              <Icon name="arrow-right" size={16} />
            </Link>
          </section>

          <section id="limits" className="doc-section">
            <span className="eyebrow eyebrow--muted">06 · Limits</span>
            <h2>What a scan cannot tell you</h2>
            <ul className="limit-list">
              <li>A low score is not a guarantee. New phishing pages often look clean for hours.</li>
              <li>JavaScript cloaking is invisible to us: we fetch HTML and never run page scripts.</li>
              <li>Reputation snapshots lag. A feed miss is not an acquittal.</li>
              <li>Certificates prove encryption, not ownership or intent.</li>
              <li>We never sign in or submit forms, so post-login behaviour is out of scope.</li>
              <li>DNS and popularity are point-in-time and can change within minutes.</li>
            </ul>
            <div className="callout callout--warn">
              <Icon name="alert" size={18} />
              <p>
                If a page asks for a password, one-time code, or card number, close it and reach the organisation through its
                official app or a bookmark you already trust — regardless of what any scanner says.
              </p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
