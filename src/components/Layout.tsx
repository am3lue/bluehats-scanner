import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { Icon } from './Icon';
import { useTour } from './Tour';

const NAV = [
  { to: '/demo', label: 'Demo library' },
  { to: '/how-to', label: 'How it works' },
  { to: '/docs', label: 'Trust & data' },
  { to: '/history', label: 'History' },
];

export function Layout() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { start } = useTour();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const goScan = () => {
    setMenuOpen(false);
    if (location.pathname === '/') {
      document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    navigate('/');
    window.setTimeout(() => {
      document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 260);
  };

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="shell header__inner">
          <Logo />
          <nav className="header__nav" aria-label="Primary" data-tour="nav">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header__actions">
            <button type="button" className="icon-btn header__tour" onClick={start} aria-label="Take a guided tour" title="Take a guided tour">
              <Icon name="help" size={19} />
            </button>
            <button type="button" className="btn btn--primary btn--sm header__cta" onClick={goScan}>
              <Icon name="scan" size={17} />
              Scan a link
            </button>
            <button
              type="button"
              className="icon-btn header__menu-btn"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'x' : 'menu'} size={21} />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="header__mobile" id="mobile-nav">
            <nav aria-label="Mobile">
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
                  {item.label}
                  <Icon name="chevron-right" size={17} />
                </NavLink>
              ))}
            </nav>
            <div className="header__mobile-actions">
              <button type="button" className="btn btn--primary" onClick={goScan}>
                <Icon name="scan" size={17} />
                Scan a link
              </button>
              <button type="button" className="btn btn--ghost" onClick={start}>
                <Icon name="help" size={17} />
                Take the tour
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <main id="main" className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer" data-tour="footer">
        <div className="shell footer__grid">
          <div className="footer__brand">
            <Logo />
            <p>
              A transparent link-triage workbench for phishing, typosquatting, and brand impersonation. Every score comes with
              receipts.
            </p>
            <span className="footer__badge">
              <Icon name="badge" size={15} />
              Built for PS-19 · Identity, privacy & fraud prevention
            </span>
          </div>
          <div className="footer__col">
            <h3>Product</h3>
            <Link to="/">Scanner</Link>
            <Link to="/demo">Demo library</Link>
            <Link to="/history">Local history</Link>
            <Link to="/how-to">How it works</Link>
          </div>
          <div className="footer__col">
            <h3>Trust</h3>
            <Link to="/docs">Data & sources</Link>
            <Link to="/docs#security">Security model</Link>
            <Link to="/docs#privacy">Privacy</Link>
            <Link to="/docs#limitations">Limitations</Link>
          </div>
          <div className="footer__col">
            <h3>Responsible use</h3>
            <p className="footer__note">
              Scores are heuristics, not proof. Never enter credentials because a scanner said a link was safe. Verify through
              official channels.
            </p>
            <button type="button" className="footer__tour" onClick={start}>
              <Icon name="play" size={15} />
              Replay the tour
            </button>
          </div>
        </div>
        <div className="shell footer__bottom">
          <span>© {new Date().getFullYear()} BlueHats Scanner</span>
          <span>No accounts. No tracking. Exports stay on your device.</span>
          <span>Hackathon prototype · verify before production use</span>
        </div>
      </footer>
    </div>
  );
}
