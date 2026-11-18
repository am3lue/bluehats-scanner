import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReportRecord, Verdict } from '@server/types';
import { Icon } from '../components/Icon';
import { useSeo } from '../lib/seo';
import { useToast } from '../components/Toast';
import { formatDateTime, scoreClass, VERDICT_SHORT } from '../lib/format';
import {
  clearHistory,
  clearLocalReports,
  loadHistory,
  loadLocalReports,
  removeLocalReport,
  removeScan,
  type HistoryEntry,
} from '../lib/storage';

const FILTERS: { id: 'all' | Verdict; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'safe', label: 'Safe' },
  { id: 'caution', label: 'Caution' },
  { id: 'suspicious', label: 'Suspicious' },
  { id: 'dangerous', label: 'Dangerous' },
];

export function HistoryPage() {
  useSeo({
    title: 'Local scan history',
    description: 'Review, reopen, or delete scans stored only in your browser.',
    path: '/history',
    noindex: true,
  });

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [filter, setFilter] = useState<'all' | Verdict>('all');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<'history' | 'reports' | null>(null);
  const { push } = useToast();

  useEffect(() => {
    setEntries(loadHistory());
    setReports(loadLocalReports());
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter !== 'all' && entry.verdict !== filter) return false;
      if (!needle) return true;
      return entry.host.toLowerCase().includes(needle) || entry.url.toLowerCase().includes(needle);
    });
  }, [entries, filter, query]);

  const stats = useMemo(() => {
    const total = entries.length;
    const risky = entries.filter((entry) => entry.verdict === 'dangerous' || entry.verdict === 'suspicious').length;
    const average = total ? Math.round(entries.reduce((sum, entry) => sum + entry.score, 0) / total) : 0;
    return { total, risky, average };
  }, [entries]);

  const deleteScan = (id: string) => {
    setEntries(removeScan(id));
    push('Scan removed from this browser.', 'success');
  };

  const wipeHistory = () => {
    clearHistory();
    setEntries([]);
    setConfirm(null);
    push('Local scan history cleared.', 'success');
  };

  const deleteReport = (id: string) => {
    setReports(removeLocalReport(id));
    push('Saved report removed from this browser.', 'success');
  };

  const wipeReports = () => {
    clearLocalReports();
    setReports([]);
    setConfirm(null);
    push('Saved reports cleared.', 'success');
  };

  return (
    <div className="page history-page">
      <section className="page-hero shell">
        <span className="eyebrow">
          <span className="eyebrow__dot" />
          On this device only
        </span>
        <h1>Your local paper trail.</h1>
        <p className="page-hero__lede">
          The last 25 scans and any reports you submitted from this browser. Nothing here is synced, and clearing it is immediate
          and permanent.
        </p>
        <div className="history-stats">
          <div className="stat-card">
            <span>Scans kept</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="stat-card">
            <span>Risky or worse</span>
            <strong>{stats.risky}</strong>
          </div>
          <div className="stat-card">
            <span>Average risk</span>
            <strong>{stats.total ? stats.average : '—'}</strong>
          </div>
          <div className="stat-card">
            <span>Saved reports</span>
            <strong>{reports.length}</strong>
          </div>
        </div>
      </section>

      <section className="shell history-body">
        <div className="history-toolbar">
          <div className="filter-chips" role="group" aria-label="Filter scans by verdict">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`filter-chip${filter === item.id ? ' is-active' : ''}${item.id !== 'all' ? ` is-${item.id}` : ''}`}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span>{item.id === 'all' ? entries.length : entries.filter((entry) => entry.verdict === item.id).length}</span>
              </button>
            ))}
          </div>
          <div className="history-toolbar__right">
            <div className="search-field">
              <Icon name="scan" size={16} />
              <label className="sr-only" htmlFor="history-search">
                Search saved scans
              </label>
              <input
                id="history-search"
                type="search"
                placeholder="Search host or URL…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {entries.length ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(confirm === 'history' ? null : 'history')}>
                <Icon name="trash" size={16} />
                Clear history
              </button>
            ) : null}
          </div>
        </div>

        {confirm === 'history' ? (
          <div className="confirm-bar" role="alertdialog" aria-label="Confirm clearing history">
            <Icon name="alert" size={18} />
            <span>Delete all {entries.length} saved scans from this browser? This cannot be undone.</span>
            <div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--danger btn--sm" onClick={wipeHistory}>
                Delete everything
              </button>
            </div>
          </div>
        ) : null}

        {filtered.length ? (
          <ul className="history-list">
            {filtered.map((entry) => (
              <li key={entry.id} className={`history-row ${scoreClass(entry.score)}`}>
                <span className={`score-dot score-dot--lg ${scoreClass(entry.score)}`}>{entry.score}</span>
                <div className="history-row__main">
                  <div className="history-row__title">
                    <strong>{entry.host}</strong>
                    <span className={`verdict-pill is-${entry.verdict}`}>{VERDICT_SHORT[entry.verdict]}</span>
                    {entry.demoCase ? (
                      <span className="tag tag--demo">
                        <Icon name="sparkles" size={11} />
                        demo
                      </span>
                    ) : null}
                  </div>
                  <span className="history-row__url" title={entry.url}>
                    {entry.url}
                  </span>
                  <span className="history-row__meta">
                    {formatDateTime(entry.scannedAt)}
                  </span>
                </div>
                <div className="history-row__actions">
                  <Link to={`/?restore=${encodeURIComponent(entry.id)}`} className="btn btn--secondary btn--sm">
                    <Icon name="eye" size={15} />
                    View report
                  </Link>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete scan of ${entry.host}`}
                    onClick={() => deleteScan(entry.id)}
                  >
                    <Icon name="trash" size={17} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <span className="empty-state__icon">
              <Icon name="history" size={30} />
            </span>
            <h2>{entries.length ? 'No scans match that filter' : 'No saved scans yet'}</h2>
            <p>
              {entries.length
                ? 'Try a different verdict filter or clear the search box.'
                : 'Run a scan and it will appear here, stored only in this browser.'}
            </p>
            <Link to="/" className="btn btn--primary">
              <Icon name="scan" size={17} />
              Scan a link
            </Link>
          </div>
        )}

        <section className="saved-reports" aria-labelledby="saved-reports-title">
          <div className="section-head section-head--tight">
            <div>
              <span className="eyebrow eyebrow--muted">Submitted from this browser</span>
              <h2 id="saved-reports-title">Saved reports</h2>
            </div>
            {reports.length ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(confirm === 'reports' ? null : 'reports')}>
                <Icon name="trash" size={16} />
                Clear reports
              </button>
            ) : null}
          </div>

          {confirm === 'reports' ? (
            <div className="confirm-bar" role="alertdialog" aria-label="Confirm clearing reports">
              <Icon name="alert" size={18} />
              <span>Remove all saved report copies from this browser? Reports already sent to the queue are unaffected.</span>
              <div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn--danger btn--sm" onClick={wipeReports}>
                  Remove copies
                </button>
              </div>
            </div>
          ) : null}

          {reports.length ? (
            <div className="reports-table">
              <div className="reports-table__row reports-table__head">
                <span>Target</span>
                <span>Verdict</span>
                <span>Status</span>
                <span>Note</span>
                <span>Submitted</span>
                <span aria-hidden="true" />
              </div>
              {reports.map((report) => (
                <div key={report.id} className="reports-table__row">
                  <span className="reports-table__target">
                    <strong>{report.host}</strong>
                    <span title={report.url}>{report.url}</span>
                  </span>
                  <span>
                    <span className={`verdict-pill is-${report.verdict}`}>{VERDICT_SHORT[report.verdict]}</span>
                  </span>
                  <span className={`report-status is-${report.status}`}>{report.status.replace('_', ' ')}</span>
                  <span className="reports-table__note">{report.note || <em>no note</em>}</span>
                  <span className="reports-table__date">{formatDateTime(report.createdAt)}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove saved report for ${report.host}`}
                    onClick={() => deleteReport(report.id)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel__empty">
              No reports submitted from this browser. Use “Report this site” on a result to add one.
            </p>
          )}
        </section>

        <p className="history-privacy">
          <Icon name="shield" size={15} />
          History and saved reports live in <code>localStorage</code> on this device. They never sync and are never sent anywhere
          unless you export or submit them.
        </p>
      </section>
    </div>
  );
}
