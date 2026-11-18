import { useState, type FormEvent } from 'react';
import type { DemoCase } from '@server/types';
import type { ScanInput } from '../lib/api';
import { Icon } from './Icon';
import type { ScanStatus } from '../hooks/useScan';

interface ScannerFormProps {
  status: ScanStatus;
  demoCases: DemoCase[];
  activeDemo?: string;
  initialUrl?: string;
  progress: number;
  onSubmit: (input: ScanInput) => void;
  onDemo: (caseId: string) => void;
  onStop: () => void;
}

function validate(value: string): string | null {
  if (!value) return 'Paste a link before scanning.';
  if (/\s/.test(value)) return 'Links cannot contain spaces — check for a stray paste.';
  if (/^(javascript|data|file|vbscript):/i.test(value)) return 'Only http and https links can be scanned.';
  if (/^https?:\/\/\S+$/i.test(value)) return null;
  if (/^[^\s/]+\.[^\s/]+/.test(value)) return null;
  return 'That does not look like a web address. Try example.com or https://example.com/login.';
}

export function ScannerForm({ status, demoCases, activeDemo, initialUrl, progress, onSubmit, onDemo, onStop }: ScannerFormProps) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [brand, setBrand] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = status === 'scanning';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const value = url.trim();
    const problem = validate(value);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onSubmit({ url: value, brand: brand.trim() || undefined });
  };

  return (
    <article className="scanner-card" id="scanner" data-tour="hero-form">
      <div className="scanner-card__head">
        <span className="pill pill--teal">
          <span className="pill__dot" />
          Live triage
        </span>
        <h2>What are we looking at?</h2>
        <p>Paste a link. We will pull the evidence, score the risk, and show every reason in plain language.</p>
      </div>

      <form className="scanner-form" onSubmit={submit} noValidate>
        <div className={`url-field${error ? ' has-error' : ''}`}>
          <Icon name="scan" size={21} className="url-field__icon" />
          <label className="sr-only" htmlFor="scan-url">
            Website link to scan
          </label>
          <input
            id="scan-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="paste a suspicious link…"
            value={url}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'scan-error scan-hint' : 'scan-hint'}
            onChange={(event) => {
              setUrl(event.target.value);
              if (error) setError(null);
            }}
            disabled={busy}
          />
          {url && !busy ? (
            <button
              type="button"
              className="url-field__clear"
              aria-label="Clear the link"
              onClick={() => {
                setUrl('');
                setError(null);
              }}
            >
              <Icon name="x" size={16} />
            </button>
          ) : null}
        </div>

        <div className="brand-field">
          <Icon name="badge" size={17} className="brand-field__icon" />
          <label htmlFor="scan-brand">Brand you expected</label>
          <input
            id="scan-brand"
            name="brand"
            type="text"
            autoComplete="off"
            placeholder="optional, e.g. PayPal"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            disabled={busy}
          />
        </div>

        {error ? (
          <p className="form-error" id="scan-error" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </p>
        ) : (
          <p className="form-hint" id="scan-hint">
            Public http(s) links only. Private and loopback addresses are blocked by the server guard.
          </p>
        )}

        <div className="scanner-form__submit">
          {busy ? (
            <button type="button" className="btn btn--primary btn--lg" onClick={onStop}>
              <span className="spinner" aria-hidden="true" />
              Stop scan
            </button>
          ) : (
            <button type="submit" className="btn btn--primary btn--lg">
              <Icon name="scan" size={19} />
              Scan the link
            </button>
          )}
          <span className="scanner-form__trust">
            <Icon name="shield" size={15} />
            Nothing is stored without your say-so
          </span>
        </div>

        {busy ? (
          <div className="scan-progress">
            <div
              className="scan-progress__bar"
              role="progressbar"
              aria-label="Scan progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <span className="scan-progress__label">Collecting evidence · {progress}%</span>
          </div>
        ) : null}
      </form>

      <div className="demo-chips" data-tour="demo-chips">
        <div className="demo-chips__head">
          <span>Or try a controlled fixture</span>
          <Icon name="sparkles" size={15} />
        </div>
        <div className="demo-chips__list">
          {demoCases.length
            ? demoCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`demo-chip is-${item.kind}${activeDemo === item.id ? ' is-active' : ''}`}
                  onClick={() => onDemo(item.id)}
                  disabled={busy}
                  title={item.blurb}
                >
                  <span className="demo-chip__dot" />
                  {item.label}
                </button>
              ))
            : Array.from({ length: 5 }).map((_, index) => (
                <span key={index} className="demo-chip demo-chip--skeleton" aria-hidden="true" />
              ))}
        </div>
      </div>
    </article>
  );
}
