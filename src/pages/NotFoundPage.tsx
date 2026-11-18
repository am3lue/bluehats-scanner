import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useSeo } from '../lib/seo';

export function NotFoundPage() {
  useSeo({
    title: 'Page not found',
    description: 'That path does not exist. Head back to the BlueHats scanner.',
    path: '/404',
    noindex: true,
  });

  return (
    <div className="page notfound-page">
      <section className="shell notfound">
        <div className="notfound__copy">
          <span className="eyebrow">
            <span className="eyebrow__dot" />
            HTTP 404
          </span>
          <h1>
            This link leads
            <br />
            <span className="ink-teal">nowhere.</span>
          </h1>
          <p>
            Which is, ironically, one of the safer outcomes. The page you asked for does not exist, but the scanner is one click
            away.
          </p>
          <div className="notfound__actions">
            <Link to="/" className="btn btn--primary">
              <Icon name="scan" size={17} />
              Back to the scanner
            </Link>
            <Link to="/demo" className="btn btn--ghost">
              Try a demo fixture
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
        <div className="notfound__terminal" aria-hidden="true">
          <div className="terminal__bar">
            <span className="terminal__dots">
              <i />
              <i />
              <i />
            </span>
            <span className="terminal__title">bluehats://404</span>
          </div>
          <pre>
            <code>{`$ resolve requested-path
[ok] parsed
[warn] no route matched
[--] returning 404 in 0.4ms

$ suggest --next
  /            scanner
  /demo        controlled fixtures
  /how-to      the method
  /docs        trust & data`}</code>
          </pre>
        </div>
      </section>
    </div>
  );
}
