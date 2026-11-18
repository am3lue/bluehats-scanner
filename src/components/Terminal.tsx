import { useEffect, useRef } from 'react';
import type { LogLine } from '@server/types';
import { formatTime } from '../lib/format';
import type { ScanStatus } from '../hooks/useScan';

interface TerminalProps {
  logs: LogLine[];
  status: ScanStatus;
  host?: string;
  error?: string | null;
}

export function Terminal({ logs, status, host, error }: TerminalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (pinnedRef.current) body.scrollTop = body.scrollHeight;
  }, [logs, status, error]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const onScroll = () => {
      pinnedRef.current = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    pinnedRef.current = true;
  }, [status]);

  const stateLabel = status === 'scanning' ? 'streaming' : status === 'done' ? 'report ready' : status === 'error' ? 'failed' : 'standby';

  return (
    <div className={`terminal is-${status}`} data-tour="hero-terminal">
      <div className="terminal__bar">
        <span className="terminal__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="terminal__title">bluehats://scan{host ? `/${host}` : ''}</span>
        <span className="terminal__state">
          <span className="terminal__pulse" aria-hidden="true" />
          {stateLabel}
        </span>
      </div>
      <div className="terminal__body" ref={bodyRef} role="log" aria-live="polite" aria-label="Live scan log" tabIndex={0}>
        {logs.length === 0 && status === 'idle' ? (
          <div className="terminal__idle">
            <p>
              <span className="terminal__prompt">$</span> scanner awaiting target
            </p>
            <p className="terminal__muted">paste a link or pick a demo fixture to begin.</p>
            <p className="terminal__muted">
              checks: <span className="terminal__ok">dns</span> · <span className="terminal__ok">tls</span> ·{' '}
              <span className="terminal__ok">redirects</span> · <span className="terminal__ok">content</span> ·{' '}
              <span className="terminal__ok">brand</span> · <span className="terminal__ok">reputation</span>
            </p>
            <p>
              <span className="terminal__prompt">$</span> <span className="terminal__caret" aria-hidden="true" />
            </p>
          </div>
        ) : null}

        {logs.map((log, index) => (
          <div key={`${log.ts}-${index}`} className={`terminal__line is-${log.level}`}>
            <span className="terminal__time">{formatTime(log.ts)}</span>
            <span className="terminal__phase">{log.phase}</span>
            <span className="terminal__msg">{log.message}</span>
          </div>
        ))}

        {status === 'scanning' ? (
          <div className="terminal__line is-active">
            <span className="terminal__caret" aria-hidden="true" />
            <span className="terminal__msg">working…</span>
          </div>
        ) : null}

        {status === 'done' ? (
          <div className="terminal__finish">
            <span className="terminal__prompt">$</span> scan complete. report rendered below.
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="terminal__finish is-error">
            <span className="terminal__prompt">!</span> {error ?? 'the scan failed before a report was produced.'}
          </div>
        ) : null}
      </div>
      <div className="terminal__foot">
        <span>{logs.length} events</span>
        <span>NDJSON · server-side checks</span>
      </div>
    </div>
  );
}
