import { useState, type ReactNode } from 'react';
import type { CategoryId, ScanResult, Severity } from '@server/types';
import { Icon, type IconName } from './Icon';
import { RiskGauge } from './RiskGauge';
import { ExportMenu } from './ExportMenu';
import { ReportModal } from './ReportModal';
import { useToast } from './Toast';
import { copyText, formatDateTime, formatDuration, formatTime, SEVERITY_LABEL, VERDICT_LABEL } from '../lib/format';
import { reportSummaryText } from '../lib/exports';

const CATEGORY_ICON: Record<CategoryId, IconName> = {
  url: 'link',
  dns: 'globe',
  tls: 'lock',
  redirects: 'route',
  content: 'file',
  brand: 'badge',
  reputation: 'shield',
};

const SOURCE_STATUS_LABEL: Record<string, string> = {
  listed: 'Listed',
  clear: 'Clear',
  not_configured: 'No API key',
  unavailable: 'Unavailable',
  skipped: 'Skipped',
};

function countText(counts: Record<Severity, number>): string {
  const parts: string[] = [];
  (['critical', 'high', 'medium', 'low', 'info'] as Severity[]).forEach((severity) => {
    if (counts[severity]) parts.push(`${counts[severity]} ${SEVERITY_LABEL[severity].toLowerCase()}`);
  });
  return parts.join(' · ');
}

function TechRow({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === '' || (Array.isArray(children) && !children.length);
  return (
    <div className="tech-row">
      <dt>{label}</dt>
      <dd>{empty ? <span className="tech-empty">—</span> : children}</dd>
    </div>
  );
}

function Chips({ items, limit = 4 }: { items: string[]; limit?: number }) {
  if (!items.length) return <span className="tech-empty">—</span>;
  const visible = items.slice(0, limit);
  return (
    <span className="tech-chips">
      {visible.map((item) => (
        <code key={item} title={item}>
          {item}
        </code>
      ))}
      {items.length > limit ? <span className="tech-more">+{items.length - limit} more</span> : null}
    </span>
  );
}

function percent(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

export function ResultView({ result, onReset }: { result: ScanResult; onReset: () => void }) {
  const [reporting, setReporting] = useState(false);
  const { push } = useToast();

  const copySummary = async () => {
    try {
      await copyText(reportSummaryText(result));
      push('Summary copied to your clipboard.', 'success');
    } catch {
      push('Clipboard access was blocked.', 'error');
    }
  };

  return (
    <section className={`result is-${result.verdict}`} id="result" aria-labelledby="result-heading">
      <div className="result__hero">
        <div className="result__intro">
          <div className="result__tags">
            <span className={`pill pill--verdict is-${result.verdict}`}>
              <span className="pill__dot" />
              {VERDICT_LABEL[result.verdict]}
            </span>
            {result.demo ? (
              <span className="pill pill--sand">
                <Icon name="sparkles" size={13} />
                Demo fixture
              </span>
            ) : null}
            <span className="pill pill--muted">
              <Icon name="scan" size={13} />
              {result.indicators.length} signals · {result.checks.length} checks
            </span>
          </div>
          <h2 id="result-heading">
            <span className={`result__verdict is-${result.verdict}`}>{VERDICT_LABEL[result.verdict]}</span>
            <span className="result__host">{result.host}</span>
          </h2>
          <p className="result__url" title={result.inputUrl}>
            <Icon name="link" size={15} />
            <span>{result.inputUrl}</span>
          </p>
          <p className="result__summary">{result.summary}</p>
          <div className="result__meta">
            <span>
              <Icon name="history" size={14} />
              {formatDateTime(result.scannedAt)}
            </span>
            <span>
              <Icon name="refresh" size={14} />
              {formatDuration(result.durationMs)}
            </span>
            <span>
              <Icon name="shield" size={14} />
              {result.confidence}% confidence
            </span>
            {result.finalUrl && result.finalUrl !== result.inputUrl ? (
              <span className="result__final" title={result.finalUrl}>
                <Icon name="route" size={14} />
                lands on {result.finalUrl.replace(/^https?:\/\//, '').slice(0, 48)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="result__dial">
          <RiskGauge score={result.score} verdict={result.verdict} confidence={result.confidence} />
        </div>
      </div>

      {result.demo ? (
        <div className="callout callout--demo">
          <Icon name="sparkles" size={18} />
          <div>
            <strong>{result.demo.label}</strong>
            <p>{result.demo.note}</p>
          </div>
        </div>
      ) : null}

      <div className="result__actions">
        <ExportMenu result={result} />
        <button type="button" className="btn btn--secondary" onClick={() => setReporting(true)}>
          <Icon name="flag" size={17} />
          Report this site
        </button>
        <button type="button" className="btn btn--ghost" onClick={copySummary}>
          <Icon name="copy" size={17} />
          Copy summary
        </button>
        <button type="button" className="btn btn--ghost result__again" onClick={onReset}>
          <Icon name="refresh" size={17} />
          Scan another
        </button>
      </div>

      <div className="result__columns">
        <section className="panel">
          <div className="panel__head">
            <h3>
              <Icon name="flag" size={18} />
              Why this verdict
            </h3>
            <span className="panel__meta">top reasons</span>
          </div>
          {result.reasons.length ? (
            <ol className="reasons">
              {result.reasons.map((reason, index) => (
                <li key={reason}>
                  <span className="reasons__index">{String(index + 1).padStart(2, '0')}</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="panel__empty">No risk reasons fired. The checks below returned clean.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h3>
              <Icon name="scan" size={18} />
              Evidence by family
            </h3>
            <span className="panel__meta">0–100 per family</span>
          </div>
          <ul className="family-list">
            {result.categories.map((category) => (
              <li key={category.id} className="family">
                <span className="family__icon">
                  <Icon name={CATEGORY_ICON[category.id]} size={16} />
                </span>
                <div className="family__body">
                  <div className="family__top">
                    <span>{category.label}</span>
                    <strong>{category.score}</strong>
                  </div>
                  <div className="family__bar" aria-hidden="true">
                    <span className={`is-${category.score >= 50 ? 'high' : category.score >= 25 ? 'mid' : 'low'}`} style={{ width: `${Math.max(2, category.score)}%` }} />
                  </div>
                  <span className="family__counts">{countText(category.counts) || 'no signals'}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <h3>
            <Icon name="alert" size={18} />
            Signals &amp; evidence
          </h3>
          <span className="panel__meta">{result.indicators.length} fired</span>
        </div>
        {result.indicators.length ? (
          <ul className="indicators">
            {result.indicators.map((indicator) => (
              <li key={indicator.id} className={`indicator is-${indicator.severity}`}>
                <div className="indicator__head">
                  <span className={`sev sev--${indicator.severity}`}>{SEVERITY_LABEL[indicator.severity]}</span>
                  <h4>{indicator.title}</h4>
                  <span className="indicator__weight" title="Weight contributed to the score">
                    +{indicator.weight}
                  </span>
                </div>
                <p>{indicator.explanation}</p>
                {indicator.evidence ? <code className="indicator__evidence">{indicator.evidence}</code> : null}
                <div className="indicator__foot">
                  <span className={`tag tag--${indicator.category}`}>
                    <Icon name={CATEGORY_ICON[indicator.category]} size={12} />
                    {indicator.category}
                  </span>
                  {indicator.source ? <span>via {indicator.source}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel__empty">
            <Icon name="check" size={18} /> Nothing suspicious fired. That is not a guarantee — verify the domain before signing in.
          </p>
        )}
      </section>

      <div className="result__columns">
        <section className="panel">
          <div className="panel__head">
            <h3>
              <Icon name="route" size={18} />
              Redirect chain
            </h3>
            <span className="panel__meta">{result.redirects.length} hops</span>
          </div>
          {result.redirects.length ? (
            <ol className="hops">
              {result.redirects.map((hop, index) => (
                <li key={`${hop.url}-${index}`} className="hop">
                  <span className={`hop__status${hop.status >= 400 ? ' is-bad' : hop.status >= 300 ? ' is-mid' : ' is-ok'}`}>{hop.status || '—'}</span>
                  <div className="hop__body">
                    <code>{hop.url}</code>
                    {hop.location ? <span className="hop__arrow">→ {hop.location}</span> : null}
                    {hop.note ? <span className="hop__note">{hop.note}</span> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="panel__empty">
              <Icon name="check" size={17} /> No redirects — the target answered directly.
            </p>
          )}
        </section>

        <section className="panel">
          <div className="panel__head">
            <h3>
              <Icon name="badge" size={18} />
              Reassuring signals
            </h3>
            <span className="panel__meta">{result.trustSignals.length} found</span>
          </div>
          {result.trustSignals.length ? (
            <ul className="trust-list">
              {result.trustSignals.map((signal) => (
                <li key={signal.id}>
                  <span className="trust-list__icon">
                    <Icon name="check" size={14} />
                  </span>
                  <div>
                    <strong>{signal.title}</strong>
                    <p>{signal.explanation}</p>
                    {signal.source ? <span className="trust-list__source">via {signal.source}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel__empty">No positive signals were strong enough to soften the score.</p>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel__head">
          <h3>
            <Icon name="database" size={18} />
            Technical evidence
          </h3>
          <span className="panel__meta">raw check output</span>
        </div>
        <div className="tech-grid">
          <details className="tech">
            <summary>
              <Icon name="globe" size={16} />
              DNS &amp; email posture
              <Icon name="chevron-down" size={15} className="tech__chev" />
            </summary>
            <dl>
              <TechRow label="Resolves">{result.dns.resolves ? 'Yes' : 'No'}</TechRow>
              <TechRow label="A records">
                <Chips items={result.dns.a} />
              </TechRow>
              <TechRow label="AAAA records">
                <Chips items={result.dns.aaaa} limit={3} />
              </TechRow>
              <TechRow label="Nameservers">
                <Chips items={result.dns.ns} limit={3} />
              </TechRow>
              <TechRow label="MX records">
                <Chips items={result.dns.mx} limit={3} />
              </TechRow>
              <TechRow label="TXT records">
                <Chips items={result.dns.txt} limit={2} />
              </TechRow>
              <TechRow label="SPF">{result.dns.spf ?? <span className="tech-empty">not found</span>}</TechRow>
              <TechRow label="DMARC">{result.dns.dmarc ?? <span className="tech-empty">not found</span>}</TechRow>
              {result.dns.skipped ? <TechRow label="Note">Lookup skipped for this target.</TechRow> : null}
            </dl>
          </details>

          <details className="tech">
            <summary>
              <Icon name="lock" size={16} />
              TLS certificate
              <Icon name="chevron-down" size={15} className="tech__chev" />
            </summary>
            <dl>
              {!result.tls.checked ? (
                <TechRow label="Status">{result.tls.skippedReason ?? 'Not checked'}</TechRow>
              ) : (
                <>
                  <TechRow label="Authorized">{result.tls.authorized ? 'Yes' : `No${result.tls.authorizationError ? ` — ${result.tls.authorizationError}` : ''}`}</TechRow>
                  <TechRow label="Subject">{result.tls.subject ?? '—'}</TechRow>
                  <TechRow label="Issuer">{result.tls.issuer ?? '—'}</TechRow>
                  <TechRow label="Protocol">{result.tls.protocol ?? '—'}</TechRow>
                  <TechRow label="Valid from">{result.tls.issuedAt ? formatDateTime(result.tls.issuedAt) : '—'}</TechRow>
                  <TechRow label="Expires">
                    {result.tls.expiresAt ? `${formatDateTime(result.tls.expiresAt)}${result.tls.daysLeft !== undefined ? ` (${result.tls.daysLeft} days)` : ''}` : '—'}
                  </TechRow>
                  <TechRow label="Cert age">{result.tls.ageDays !== undefined ? `${result.tls.ageDays} days` : '—'}</TechRow>
                  <TechRow label="Hostname match">{result.tls.hostnameMatch === undefined ? '—' : result.tls.hostnameMatch ? 'Yes' : 'No'}</TechRow>
                  <TechRow label="Self-signed">{result.tls.selfSigned === undefined ? '—' : result.tls.selfSigned ? 'Yes' : 'No'}</TechRow>
                  <TechRow label="Alt names">
                    <Chips items={result.tls.altNames ?? []} limit={4} />
                  </TechRow>
                  <TechRow label="Fingerprint">
                    <code title={result.tls.fingerprint}>{result.tls.fingerprint ? `${result.tls.fingerprint.slice(0, 24)}…` : '—'}</code>
                  </TechRow>
                </>
              )}
            </dl>
          </details>

          <details className="tech">
            <summary>
              <Icon name="file" size={16} />
              Page content
              <Icon name="chevron-down" size={15} className="tech__chev" />
            </summary>
            <dl>
              <TechRow label="Fetched">{result.content.fetched ? `Yes · HTTP ${result.content.status ?? '—'}` : result.content.error ?? 'No'}</TechRow>
              <TechRow label="Final URL">{result.content.finalUrl ?? '—'}</TechRow>
              <TechRow label="Title">{result.content.title ?? '—'}</TechRow>
              <TechRow label="Description">{result.content.description ?? '—'}</TechRow>
              <TechRow label="Visible text">{result.content.textLength !== undefined ? `${result.content.textLength.toLocaleString()} chars` : '—'}</TechRow>
              <TechRow label="Forms">
                {result.content.forms.length
                  ? result.content.forms.map((form) => `${form.method.toUpperCase()} ${form.action || '(same page)'}${form.crossOrigin ? ' [cross-origin]' : ''}`).join(' · ')
                  : 'none'}
              </TechRow>
              <TechRow label="Password fields">{result.content.passwordFields}</TechRow>
              <TechRow label="Iframes">{result.content.iframes}</TechRow>
              <TechRow label="External scripts">{result.content.externalScripts}</TechRow>
              <TechRow label="Obfuscation hits">{result.content.obfuscationHits}</TechRow>
              <TechRow label="Meta refresh">{result.content.metaRefresh ?? 'none'}</TechRow>
              <TechRow label="Copyright year">{result.content.copyrightYear ?? '—'}</TechRow>
            </dl>
          </details>

          <details className="tech">
            <summary>
              <Icon name="badge" size={16} />
              Brand comparison
              <Icon name="chevron-down" size={15} className="tech__chev" />
            </summary>
            <dl>
              <TechRow label="Brand">{result.brand.brand ?? '—'}</TechRow>
              <TechRow label="Expected domain">{result.brand.expectedDomain ?? '—'}</TechRow>
              <TechRow label="Actual domain">{result.brand.actualDomain ?? '—'}</TechRow>
              <TechRow label="Domain match">{result.brand.domainMatches === undefined ? '—' : result.brand.domainMatches ? 'Yes' : 'No'}</TechRow>
              <TechRow label="Edit distance">{result.brand.domainDistance ?? '—'}</TechRow>
              <TechRow label="Title similarity">{percent(result.brand.titleSimilarity)}</TechRow>
              <TechRow label="Text similarity">{percent(result.brand.textSimilarity)}</TechRow>
              <TechRow label="Brand mentions">{result.brand.mentionCount ?? '—'}</TechRow>
              <TechRow label="Detected from">{result.brand.detectedFrom ?? '—'}</TechRow>
              <TechRow label="Reference">{result.brand.referenceUsed ?? '—'}</TechRow>
            </dl>
          </details>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h3>
            <Icon name="shield" size={18} />
            Sources &amp; freshness
          </h3>
          <span className="panel__meta">
            {result.reputation.trancoRank ? `Tranco #${result.reputation.trancoRank.toLocaleString()}` : 'not in Tranco top list'}
          </span>
        </div>
        <div className="sources-table" role="table" aria-label="Reputation sources">
          <div className="sources-table__row sources-table__head" role="row">
            <span role="columnheader">Source</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Detail</span>
            <span role="columnheader">Freshness</span>
          </div>
          {result.reputation.sources.map((source) => (
            <div className="sources-table__row" role="row" key={source.id}>
              <span role="cell" className="sources-table__name">
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer noopener">
                    {source.name}
                    <Icon name="external" size={12} />
                  </a>
                ) : (
                  source.name
                )}
              </span>
              <span role="cell">
                <span className={`source-status is-${source.status}`}>{SOURCE_STATUS_LABEL[source.status] ?? source.status}</span>
              </span>
              <span role="cell" className="sources-table__detail">
                {source.detail}
              </span>
              <span role="cell" className="sources-table__fresh">
                {source.freshness ? formatDateTime(source.freshness) : '—'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="result__columns">
        <details className="panel panel--fold">
          <summary>
            <span>
              <Icon name="info" size={17} />
              What this scan cannot tell you
            </span>
            <Icon name="chevron-down" size={16} className="fold__chev" />
          </summary>
          <ul className="limitations">
            {result.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>

        <details className="panel panel--fold">
          <summary>
            <span>
              <Icon name="terminal" size={17} />
              Full scan log
            </span>
            <span className="fold__meta">{result.logs.length} events</span>
            <Icon name="chevron-down" size={16} className="fold__chev" />
          </summary>
          <ol className="log-list">
            {result.logs.map((log, index) => (
              <li key={`${log.ts}-${index}`} className={`is-${log.level}`}>
                <span className="log-list__time">{formatTime(log.ts)}</span>
                <span className="log-list__phase">{log.phase}</span>
                <span className="log-list__msg">{log.message}</span>
              </li>
            ))}
          </ol>
        </details>
      </div>

      <div className="result__footer">
        <span className="result__disclaimer">
          <Icon name="shield" size={16} />
          Heuristic assessment, not proof. Verify the domain through official channels before entering credentials.
        </span>
        <div className="result__footer-actions">
          <ExportMenu result={result} />
          <button type="button" className="btn btn--secondary" onClick={onReset}>
            Scan another link
          </button>
        </div>
      </div>

      {reporting ? <ReportModal result={result} onClose={() => setReporting(false)} /> : null}
    </section>
  );
}
