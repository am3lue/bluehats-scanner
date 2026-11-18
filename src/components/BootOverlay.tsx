import { useEffect, useState } from 'react';
import { hasBooted, markBooted } from '../lib/storage';
import { Icon } from './Icon';

const LINES = [
  ['$', 'boot bluehats --safe'],
  ['ok', 'url heuristics ........ loaded'],
  ['ok', 'reputation feeds ...... 132k domains'],
  ['ok', 'ssrf guard ............ pinned'],
  ['#', 'ready. paste a link to scan.'],
] as const;

export function BootOverlay() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (new URLSearchParams(window.location.search).has('noboot')) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return !hasBooted();
  });

  useEffect(() => {
    if (!visible) return;
    const finish = () => {
      markBooted();
      setVisible(false);
    };
    const timer = window.setTimeout(finish, 2400);
    const onKey = () => finish();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="boot" role="dialog" aria-label="BlueHats Scanner is starting">
      <div className="boot__panel">
        <div className="boot__brand">
          <span className="boot__hat">
            <Icon name="hat" size={30} />
          </span>
          <div>
            <strong>BlueHats Scanner</strong>
            <span>explainable link triage</span>
          </div>
        </div>
        <pre className="boot__log" aria-live="polite">
          {LINES.map(([tag, text], index) => (
            <span key={text} className={`boot__line boot__line--${tag === 'ok' ? 'ok' : tag === '#' ? 'muted' : 'cmd'}`} style={{ animationDelay: `${180 + index * 380}ms` }}>
              {tag === 'ok' ? '[ok]' : tag} {text}
            </span>
          ))}
        </pre>
        <button
          type="button"
          className="boot__skip"
          onClick={() => {
            markBooted();
            setVisible(false);
          }}
        >
          skip intro
        </button>
      </div>
    </div>
  );
}
