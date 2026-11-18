import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMeta, type MetaInfo } from '../lib/api';
import { Icon } from '../components/Icon';
import { useSeo } from '../lib/seo';
import { formatDateTime } from '../lib/format';

const TOC = [
  { id: 'overview', label: 'What this is' },
  { id: 'sources', label: 'Sources & freshness' },
  { id: 'security', label: 'Security model' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'api', label: 'API' },
  { id: 'limits', label: 'Limitations' },
  { id: 'license', label: 'License & credits' },
];

const BUNDLED = [
  { id: 'openphish', name: 'OpenPhish community feed', kind: 'Bundled URL list', url: 'https://openphish.com/feed.txt' },
  { id: 'cert-pl', name: 'CERT Polska warning list', kind: 'Bundled domain list', url: 'https://hole.cert.pl/domains/v2/domains.txt' },
  { id: 'spam404', name: 'Spam404 blacklist', kind: 'Bundled domain list', url: 'https://raw.githubusercontent.com/Spam404/lists/master/main-blacklist.txt' },
];

const LIVE = [
  { name: 'Spamhaus DBL', kind: 'Live DNSBL query', note: 'Domain blocklist; a timeout is reported as unavailable, never as clear.' },
  { name: 'SURBL', kind: 'Live DNSBL query', note: 'Spam URI blocklist for domains found in unsolicited messages.' },
  { name: 'Tranco', kind: 'Popularity lookup', note: 'Rank context only. Popular does not mean safe; unranked does not mean malicious.' },
];

const OPTIONAL = [
  { env: 'GOOGLE_SAFE_BROWSING_KEY', name: 'Google Safe Browsing', note: 'Malware and social-engineering matches.' },
  { env: 'URLHAUS_AUTH_KEY', name: 'URLhaus', note: 'Malware distribution URLs.' },
  { env: 'VIRUSTOTAL_API_KEY', name: 'VirusTotal', note: 'Last analysis stats for the URL.' },
  { env: 'PHISHTANK_KEY', name: 'PhishTank', note: 'Community phishing verification.' },
  { env: 'CLOUDFLARE_RADAR_TOKEN', name: 'Cloudflare Radar', note: 'Domain ranking and category context.' },
];

const ENDPOINTS = [
  { method: 'GET', path: '/api/health', note: 'Liveness and feed load state.' },
  { method: 'GET', path: '/api/meta', note: 'Version, store backend, feed counts and freshness, demo cases.' },
  { method: 'GET', path: '/api/demo/cases', note: 'Controlled fixture catalogue.' },
  { method: 'POST', path: '/api/scan', note: 'Run a full scan and return one ScanResult JSON object.' },
  { method: 'POST', path: '/api/scan/stream', note: 'Same scan as NDJSON: log events, then a result or error event.' },
  { method: 'GET', path: '/api/reports', note: 'List review-queue reports.' },
  { method: 'POST', path: '/api/reports', note: 'Submit a report (url, host, verdict, score, optional note).' },
  { method: 'PATCH', path: '/api/reports/:id', note: 'Update status or note.' },
  { method: 'DELETE', path: '/api/reports/:id', note: 'Delete one report.' },
  { method: 'DELETE', path: '/api/reports', note: 'Clear the queue (demo only; protect this in a real deployment).' },
];

export function DocsPage() {
  useSeo({
    title: 'Trust, data & security — BlueHats Scanner',
    description:
      'How BlueHats handles data, which reputation sources it queries, how the SSRF guard works, the JSON API, and the honest limitations of heuristic phishing detection.',
    path: '/docs',
  });

  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [active, setActive] = useState('overview');

  useEffect(() => {
    let live = true;
    fetchMeta()
      .then((info) => live && setMeta(info))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

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
    <div className="page docs-page">
      <section className="page-hero shell">
        <span className="eyebrow">
          <span className="eyebrow__dot" />
          Trust &amp; data
        </span>
        <h1>The boring details, on purpose.</h1>
        <p className="page-hero__lede">
          What gets fetched, what gets stored, which feeds are consulted, and what the score cannot prove. If a claim is not
          supported by the code, it should not be on this page.
        </p>
        <div className="page-hero__actions">
          <span className={`status-chip${meta?.feeds.loaded ? ' is-ok' : ''}`}>
            <span className="status-chip__dot" />
            {meta?.feeds.loaded
              ? `Feeds loaded · ${meta.feeds.domains.toLocaleString()} domains / ${meta.feeds.urls.toLocaleString()} URLs`
              : 'Feed status unavailable'}
          </span>
          <span className="status-chip">
            <Icon name="database" size={14} />
            {meta ? `${meta.store} review store` : 'store unknown'}
          </span>
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
            <Icon name="info" size={18} />
            <p>
              Found a security issue? Use the hackathon submission channel to contact the maintainer privately. Please do not open
              a public issue with a working exploit.
            </p>
          </div>
        </aside>

        <article className="doc-body">
          <section id="overview" className="doc-section">
            <span className="eyebrow eyebrow--muted">01 · Scope</span>
            <h2>An evidence workbench, not an oracle</h2>
            <p>
              BlueHats is a hackathon build for PS-19: fake websites, brand impersonation, and scam detection. A scan fetches one
              public page as an anonymous visitor, inspects the surrounding infrastructure, and returns an explainable risk score.
              It does not crawl, authenticate, submit forms, or execute page JavaScript.
            </p>
            <div className="scope-grid">
              <div className="scope-card">
                <h3>
                  <Icon name="check" size={17} />
                  In scope
                </h3>
                <ul>
                  <li>Typosquats, homoglyphs, and brand names in the wrong domain</li>
                  <li>Public phishing-feed and DNSBL reputation</li>
                  <li>Redirect chains, TLS facts, and page-level credential signals</li>
                  <li>Plain-language reasons and exportable evidence</li>
                </ul>
              </div>
              <div className="scope-card scope-card--muted">
                <h3>
                  <Icon name="x" size={17} />
                  Out of scope
                </h3>
                <ul>
                  <li>Pages behind a login or paywall</li>
                  <li>JavaScript cloaking, drive-by exploits, and post-login behaviour</li>
                  <li>Email header analysis or attachment detonation</li>
                  <li>Legal proof that a site is malicious</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="sources" className="doc-section">
            <span className="eyebrow eyebrow--muted">02 · Sources</span>
            <h2>Bundled snapshots, live queries, optional keys</h2>
            <p>
              The core build works without accounts or API keys. Feeds are snapshotted into <code>server/data/feeds.json</code> by{' '}
              <code>npm run feeds</code>. Every scan reports when a source was unavailable; unavailable is not treated as clean.
            </p>
            <div className="source-table" role="table" aria-label="Bundled feed snapshots">
              <div className="source-table__row source-table__head" role="row">
                <span role="columnheader">Bundled source</span>
                <span role="columnheader">Type</span>
                <span role="columnheader">Entries</span>
                <span role="columnheader">Snapshot</span>
              </div>
              {BUNDLED.map((source) => {
                const info = meta?.feeds.sources.find((entry) => entry.id === source.id);
                return (
                  <div className="source-table__row" role="row" key={source.id}>
                    <span role="cell">
                      <a href={source.url} target="_blank" rel="noreferrer noopener">
                        {source.name}
                        <Icon name="external" size={12} />
                      </a>
                    </span>
                    <span role="cell">{source.kind}</span>
                    <span role="cell">{info ? info.count.toLocaleString() : '—'}</span>
                    <span role="cell">{info ? formatDateTime(info.fetchedAt) : meta ? 'not loaded' : '—'}</span>
                  </div>
                );
              })}
            </div>
            <h3 className="doc-subhead">Live lookups</h3>
            <ul className="source-list">
              {LIVE.map((source) => (
                <li key={source.name}>
                  <strong>{source.name}</strong>
                  <span className="source-list__kind">{source.kind}</span>
                  <p>{source.note}</p>
                </li>
              ))}
            </ul>
            <h3 className="doc-subhead">Optional adapters (free keys)</h3>
            <p>Each adapter stays “not configured” until its environment variable is set. No key ever reaches the browser.</p>
            <div className="source-table" role="table" aria-label="Optional reputation adapters">
              <div className="source-table__row source-table__head" role="row">
                <span role="columnheader">Service</span>
                <span role="columnheader">Environment variable</span>
                <span role="columnheader">Adds</span>
              </div>
              {OPTIONAL.map((source) => (
                <div className="source-table__row" role="row" key={source.env}>
                  <span role="cell">{source.name}</span>
                  <span role="cell">
                    <code>{source.env}</code>
                  </span>
                  <span role="cell">{source.note}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="security" className="doc-section">
            <span className="eyebrow eyebrow--muted">03 · Security</span>
            <h2>The scanner is a server that fetches untrusted URLs</h2>
            <p>
              That is the whole threat model. The fetch path is deliberately boring: resolve, validate, pin, cap, and never follow a
              target into a private network.
            </p>
            <div className="security-grid">
              <div className="security-card">
                <h3>
                  <Icon name="shield" size={18} />
                  SSRF guard
                </h3>
                <ul>
                  <li>Resolve the hostname before connecting and reject any non-public IPv4 or IPv6 result.</li>
                  <li>Pin the validated address for the request to defeat DNS rebinding.</li>
                  <li>Re-validate every redirect target; cap the chain at five hops.</li>
                  <li>Reject loopback, link-local, private, multicast, and reserved ranges.</li>
                </ul>
              </div>
              <div className="security-card">
                <h3>
                  <Icon name="lock" size={18} />
                  Request limits
                </h3>
                <ul>
                  <li>5.5-second timeout and a 1.4 MB response cap per fetch.</li>
                  <li>HTML is parsed as text; no page scripts run and no forms are submitted.</li>
                  <li>32 KB JSON body limit on the API.</li>
                  <li>Rate limits: 40 scans/minute and 30 report actions/minute per client.</li>
                </ul>
              </div>
              <div className="security-card">
                <h3>
                  <Icon name="terminal" size={18} />
                  Browser hardening
                </h3>
                <ul>
                  <li>Strict CSP, <code>frame-ancestors 'none'</code>, and <code>object-src 'none'</code>.</li>
                  <li>No third-party scripts, analytics, or remote fonts.</li>
                  <li>Reports render as React text, never as raw HTML.</li>
                  <li>Secrets live in server environment variables only.</li>
                </ul>
              </div>
              <div className="security-card">
                <h3>
                  <Icon name="flag" size={18} />
                  Before public deployment
                </h3>
                <ul>
                  <li>Put authentication or an allowlist in front of the review-queue admin routes.</li>
                  <li>Keep the serverless function inside a region that suits your data rules.</li>
                  <li>Run the dependency audit and keep the feed refresh on a schedule.</li>
                  <li>Do not expose the raw scan API as an open proxy without rate limits.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="privacy" className="doc-section">
            <span className="eyebrow eyebrow--muted">04 · Privacy</span>
            <h2>What is stored, and where</h2>
            <p>
              No accounts, no cookies for tracking, no third-party analytics, and no advertising identifiers. The browser stores a
              few small preferences and your scan history locally.
            </p>
            <div className="privacy-list">
              <div>
                <strong>Live scan</strong>
                <p>Processed in server memory and returned to your browser. It is not written to a database. Hosting or proxy logs may still record request metadata such as IP and user agent.</p>
              </div>
              <div>
                <strong>Browser history</strong>
                <p>Up to 25 scans are kept in <code>localStorage</code> so you can reopen a report. Clear it from History at any time. It never leaves the device unless you export it.</p>
              </div>
              <div>
                <strong>Reports</strong>
                <p>A report is written only when you press submit. It contains the URL, host, verdict, score, and your note. The local store is a JSON file; the optional Turso backend stores the same fields in a hosted database.</p>
              </div>
              <div>
                <strong>Preferences</strong>
                <p>The tour-seen flag lives in <code>localStorage</code>; the boot intro is marked in <code>sessionStorage</code>. Both are trivial to clear.</p>
              </div>
            </div>
            <div className="callout callout--note">
              <Icon name="info" size={18} />
              <p>
                Do not scan private links that contain access tokens, signed URLs, or personal data. The server must fetch the URL
                to inspect it, so anything embedded in the address is visible to the server.
              </p>
            </div>
          </section>

          <section id="api" className="doc-section">
            <span className="eyebrow eyebrow--muted">05 · API</span>
            <h2>Small JSON surface</h2>
            <p>
              The web app uses the same endpoints that are documented here. Scan requests accept <code>url</code>,{' '}
              <code>demoCase</code>, and an optional <code>brand</code>.
            </p>
            <div className="endpoint-table" role="table" aria-label="API endpoints">
              {ENDPOINTS.map((endpoint) => (
                <div className="endpoint" role="row" key={`${endpoint.method}-${endpoint.path}`}>
                  <span className={`method method--${endpoint.method.toLowerCase()}`}>{endpoint.method}</span>
                  <code>{endpoint.path}</code>
                  <span>{endpoint.note}</span>
                </div>
              ))}
            </div>
            <div className="code-pair">
              <div>
                <h3>Request</h3>
                <pre>
                  <code>{`curl -s https://bluehats-scanner.vercel.app/api/scan \\
  -H 'content-type: application/json' \\
  -d '{"url":"https://example.com","brand":"Example"}'`}</code>
                </pre>
              </div>
              <div>
                <h3>Stream events</h3>
                <pre>
                  <code>{`{"type":"log","log":{"phase":"dns","level":"success",...}}
{"type":"log","log":{"phase":"tls","level":"success",...}}
{"type":"result","result":{"score":0,"verdict":"safe",...}}`}</code>
                </pre>
              </div>
            </div>
            <p className="doc-fineprint">
              A scan result includes: <code>score</code>, <code>verdict</code>, <code>confidence</code>, <code>summary</code>,{' '}
              <code>reasons</code>, <code>indicators</code>, <code>trustSignals</code>, <code>checks</code>,{' '}
              <code>categories</code>, <code>redirects</code>, <code>dns</code>, <code>tls</code>, <code>content</code>,{' '}
              <code>brand</code>, <code>reputation</code>, <code>logs</code>, and <code>limitations</code>.
            </p>
          </section>

          <section id="limits" className="doc-section">
            <span className="eyebrow eyebrow--muted">06 · Limits</span>
            <h2>Honest failure modes</h2>
            <ul className="limit-list">
              <li>Heuristics produce leads, not proof. A low score never guarantees a site is safe.</li>
              <li>JavaScript-only cloaking can be missed because scripts never execute.</li>
              <li>Reputation snapshots lag behind new campaigns; blocklists occasionally contain false positives.</li>
              <li>Certificates prove who signed them, not who owns or operates the site.</li>
              <li>DNS and popularity data are point-in-time observations.</li>
              <li>We never submit forms or sign in, so post-credential behaviour is invisible.</li>
            </ul>
            <p>
              These limits are repeated inside every report so a reader never sees a score without the caveat. See{' '}
              <Link to="/how-to#limits" className="text-link">
                How it works
              </Link>{' '}
              for the method behind each check.
            </p>
          </section>

          <section id="license" className="doc-section">
            <span className="eyebrow eyebrow--muted">07 · Credits</span>
            <h2>License and attribution</h2>
            <p>
              No license file is included in this hackathon build. Treat the source as private until the owner adds an explicit
              license.
            </p>
            <ul className="credit-list">
              <li>
                <strong>Typefaces:</strong> Outfit and JetBrains Mono, self-hosted under the SIL Open Font License.
              </li>
              <li>
                <strong>Icons:</strong> original inline SVG drawn for this project.
              </li>
              <li>
                <strong>Feeds:</strong> OpenPhish, CERT Polska, Spam404, Spamhaus, SURBL, and Tranco, used within their published
                terms for non-commercial, defensive triage.
              </li>
              <li>
                <strong>Optional services:</strong> Google Safe Browsing, URLhaus, VirusTotal, PhishTank, and Cloudflare Radar when
                the operator supplies a key.
              </li>
              <li>
                <strong>Built for:</strong> PS-19 — fake websites, brand impersonation, and scam detection.
              </li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
