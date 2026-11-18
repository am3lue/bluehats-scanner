import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DemoCase } from '@server/types';
import { fetchDemoCases } from '../lib/api';
import { Icon } from '../components/Icon';
import { useSeo } from '../lib/seo';
import { useToast } from '../components/Toast';

const KIND_LABEL: Record<DemoCase['kind'], string> = {
  safe: 'Clean control',
  caution: 'Soft signals',
  suspicious: 'Likely impersonation',
  dangerous: 'High risk',
};

export function DemoPage() {
  useSeo({
    title: 'Demo library — controlled phishing fixtures',
    description:
      'Six controlled BlueHats demo fixtures cover typosquatting, homoglyphs, redirect chains, cloned brands, parked domains, and a clean control. No real malicious sites involved.',
    path: '/demo',
  });

  const [cases, setCases] = useState<DemoCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { push } = useToast();

  const load = () => {
    setLoading(true);
    setError(null);
    fetchDemoCases()
      .then((list) => setCases(list))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load demo fixtures.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const run = (fixture: DemoCase) => {
    push(`Opening ${fixture.label} on the scanner…`, 'info');
    navigate(`/?demo=${encodeURIComponent(fixture.id)}`);
  };

  return (
    <div className="page demo-page">
      <section className="page-hero shell">
        <span className="eyebrow">
          <span className="eyebrow__dot" />
          Demo library
        </span>
        <h1>Six believable traps. Zero real danger.</h1>
        <p className="page-hero__lede">
          These are controlled fixtures, not live malicious websites. Each one exercises a different failure mode so you can
          watch the scoring engine work with the receipts attached.
        </p>
        <div className="page-hero__actions">
          <Link to="/" className="btn btn--ghost">
            <Icon name="arrow-right" size={17} className="flip-x" />
            Back to scanner
          </Link>
          <span className="page-hero__note">
            <Icon name="shield" size={15} />
            Offline fixture pages · illustrative hostnames
          </span>
        </div>
      </section>

      <section className="shell demo-grid-wrap">
        {error ? (
          <div className="callout callout--error" role="alert">
            <Icon name="alert" size={20} />
            <div>
              <strong>Fixtures did not load</strong>
              <p>{error} The API may still be starting.</p>
            </div>
            <button type="button" className="btn btn--secondary btn--sm" onClick={load}>
              <Icon name="refresh" size={16} />
              Retry
            </button>
          </div>
        ) : null}

        <div className="demo-grid">
          {loading && !cases.length
            ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="demo-tile demo-tile--skeleton" aria-hidden="true" />)
            : cases.map((fixture) => (
                <article key={fixture.id} className={`demo-tile is-${fixture.kind}`}>
                  <div className="demo-tile__top">
                    <span className={`pill pill--kind is-${fixture.kind}`}>
                      <span className="pill__dot" />
                      {KIND_LABEL[fixture.kind]}
                    </span>
                    {fixture.brand ? <span className="demo-tile__brand">{fixture.brand}</span> : null}
                  </div>
                  <h2>{fixture.label}</h2>
                  <code className="demo-tile__url">{fixture.displayUrl}</code>
                  <p>{fixture.blurb}</p>
                  <ul className="demo-tile__highlights">
                    {fixture.highlights.map((highlight) => (
                      <li key={highlight}>
                        <Icon name="check" size={13} />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                  <div className="demo-tile__foot">
                    {fixture.brandDomain ? <span className="demo-tile__meta">real: {fixture.brandDomain}</span> : <span className="demo-tile__meta">clean control</span>}
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => run(fixture)}>
                      Run fixture
                      <Icon name="play" size={14} />
                    </button>
                  </div>
                </article>
              ))}
        </div>
      </section>

      <section className="shell demo-notes">
        <div className="demo-notes__card">
          <h2>
            <Icon name="info" size={19} />
            How the fixtures work
          </h2>
          <p>
            A fixture supplies a deterministic HTML page, a redirect manifest, DNS and TLS facts, and reputation entries. The
            scanner runs the same pipeline as a live scan but swaps the network transport for local fixture data. Private-address
            guards still run, so the demo path cannot be used to reach internal services.
          </p>
          <ul>
            <li>Fixture pages never include working credential forms or tracking.</li>
            <li>Hostnames such as <code>paypa1-secure.example</code> are illustrative and reserved for demos.</li>
            <li>Exports from a demo are watermarked as fixture reports.</li>
          </ul>
        </div>
        <div className="demo-notes__card demo-notes__card--accent">
          <h2>
            <Icon name="flag" size={19} />
            Found a real trap?
          </h2>
          <p>
            A scan can be submitted to the human review queue from the result screen. Include what the site asked for — password,
            card, one-time code — but never paste real credentials into a note.
          </p>
          <Link to="/how-to" className="text-link">
            See how reports are scored
            <Icon name="arrow-right" size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
