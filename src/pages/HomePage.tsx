import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { DemoCase } from '@server/types';
import type { MetaInfo, ScanInput } from '../lib/api';
import { fetchDemoCases, fetchMeta } from '../lib/api';
import { useScanWorkbench } from '../hooks/useScan';
import { ScannerForm } from '../components/ScannerForm';
import { Terminal } from '../components/Terminal';
import { ResultView } from '../components/ResultView';
import { Icon } from '../components/Icon';
import { useSeo } from '../lib/seo';
import { useToast } from '../components/Toast';
import { formatDateTime, scoreClass, VERDICT_SHORT } from '../lib/format';
import { loadHistory, type HistoryEntry } from '../lib/storage';

const FAQ = [
  {
    question: 'Is the link I scan stored?',
    answer:
      'Live scans are processed in memory and are not saved to a database. Your browser may keep a local copy in History unless you clear it. A URL is only written to the server review queue if you explicitly submit a report.',
  },
  {
    question: 'Does a “safe” score guarantee the site is legitimate?',
    answer:
      'No. BlueHats uses heuristics and public reputation feeds. A brand-new phishing page can look clean. Treat the score as one input and always verify the domain through an official app or bookmark.',
  },
  {
    question: 'What evidence does a scan collect?',
    answer:
      'DNS records, TLS certificate facts, redirect hops, page content signals (forms, password fields, obfuscation), brand lookalike distance, and reputation lookups against OpenPhish, CERT Polska, Spam404, DNS blocklists, and Tranco.',
  },
  {
    question: 'Can it scan a page behind a login?',
    answer:
      'No. The scanner only sees public content and never authenticates, submits forms, or runs page JavaScript. That protects you and keeps the scan safe.',
  },
  {
    question: 'Why ask for the brand I expected?',
    answer:
      'If you tell us the brand, we can compare the real domain against the scanned one, measure edit distance and page similarity, and flag impersonation that reputation feeds have not caught yet.',
  },
  {
    question: 'Does the demo use real malicious sites?',
    answer:
      'No. Demo fixtures are controlled, offline simulations with illustrative hostnames. They exercise the same scoring engine without sending you to a live trap.',
  },
];

const FAQ_JSONLD = [
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  },
];

const STEPS = [
  {
    icon: 'link' as const,
    title: 'Drop in a link',
    body: 'Paste the URL — or name the brand you expected. No account, no extension, no tracking pixel.',
  },
  {
    icon: 'scan' as const,
    title: 'We collect receipts',
    body: 'DNS, certificate, redirects, page structure, brand similarity, and reputation feeds run in sequence.',
  },
  {
    icon: 'badge' as const,
    title: 'You get a verdict',
    body: 'A 0–100 risk score with plain-language reasons, the evidence behind each one, and exports you control.',
  },
];

const FAMILIES = [
  { icon: 'link' as const, label: 'URL shape', note: 'punycode, lures, shorteners, odd ports' },
  { icon: 'globe' as const, label: 'DNS posture', note: 'records, SPF, DMARC, resolution' },
  { icon: 'lock' as const, label: 'TLS identity', note: 'issuer, age, hostname match' },
  { icon: 'route' as const, label: 'Redirects', note: 'hop chain and cross-domain jumps' },
  { icon: 'file' as const, label: 'Page content', note: 'forms, password fields, obfuscation' },
  { icon: 'badge' as const, label: 'Brand clone', note: 'edit distance and page similarity' },
  { icon: 'shield' as const, label: 'Reputation', note: 'phishing feeds and DNS blocklists' },
];

export function HomePage() {
  useSeo({
    title: 'BlueHats Scanner — check a link before you click',
    description:
      'Free, explainable phishing and brand-impersonation scanner. Paste a link to inspect DNS, TLS, redirects, page signals, and reputation feeds, with a transparent 0–100 risk score.',
    path: '/',
    jsonLd: FAQ_JSONLD,
  });

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const urlParam = params.get('url') ?? '';
  const restoreParam = params.get('restore');
  const demoParam = params.get('demo');
  const { status, logs, result, error, progress, run, reset, abort, setResult, setLogs, setStatus, setProgress } = useScanWorkbench();
  const [demoCases, setDemoCases] = useState<DemoCase[]>([]);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [activeDemo, setActiveDemo] = useState<string | undefined>();
  const [formKey, setFormKey] = useState(0);
  const [recent, setRecent] = useState<HistoryEntry[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  const scannedRef = useRef<string | null>(null);
  const lastInput = useRef<ScanInput | null>(null);
  const restoredRef = useRef(false);
  const demoRanRef = useRef(false);

  useEffect(() => {
    let live = true;
    Promise.all([fetchMeta(), fetchDemoCases()])
      .then(([metaInfo, cases]) => {
        if (!live) return;
        setMeta(metaInfo);
        setDemoCases(cases);
      })
      .catch(() => {
        /* API may be starting; the form still renders */
      });
    setRecent(loadHistory());
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (status === 'done') setRecent(loadHistory());
  }, [status, result?.id]);

  useEffect(() => {
    if (status !== 'done' || !result) return;
    if (scannedRef.current === result.id) return;
    scannedRef.current = result.id;
    window.setTimeout(() => {
      document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 160);
  }, [status, result]);

  useEffect(() => {
    if (restoredRef.current || !restoreParam) return;
    restoredRef.current = true;
    const entry = loadHistory().find((item) => item.id === restoreParam);
    if (entry?.result) {
      setResult(entry.result);
      setLogs(entry.result.logs);
      setStatus('done');
      setProgress(100);
      setActiveDemo(entry.demoCase);
      setRecent(loadHistory());
      window.setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 320);
    }
  }, [restoreParam, setLogs, setProgress, setResult, setStatus]);

  useEffect(() => {
    if (!demoParam || demoRanRef.current || !demoCases.length) return;
    if (!demoCases.some((item) => item.id === demoParam)) return;
    demoRanRef.current = true;
    setActiveDemo(demoParam);
    void run({ demoCase: demoParam });
    navigate('/', { replace: true });
  }, [demoParam, demoCases, navigate, run]);

  const runScan = (input: ScanInput) => {
    lastInput.current = input;
    setActiveDemo(input.demoCase);
    void run(input);
  };

  const submit = (input: ScanInput) => {
    runScan(input);
  };

  const demo = (caseId: string) => {
    const fixture = demoCases.find((item) => item.id === caseId);
    if (fixture) push(`Loading fixture: ${fixture.label}`, 'info');
    runScan({ demoCase: caseId });
  };

  const handleReset = () => {
    reset();
    setActiveDemo(undefined);
    setFormKey((key) => key + 1);
    scannedRef.current = null;
    window.setTimeout(() => {
      document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const restoreEntry = (entry: HistoryEntry) => {
    if (entry.result) {
      setResult(entry.result);
      setLogs(entry.result.logs);
      setStatus('done');
      setProgress(100);
      setActiveDemo(entry.demoCase);
      window.setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 160);
    } else {
      runScan({ url: entry.url, demoCase: entry.demoCase });
    }
  };

  const coverage = useMemo(() => {
    if (!meta?.feeds?.loaded) return 'open-source phishing feeds';
    return `${meta.feeds.domains.toLocaleString()} domains · ${meta.feeds.urls.toLocaleString()} URLs`;
  }, [meta]);

  return (
    <div className="home">
      <section className="hero shell">
        <div className="hero__copy">
          <span className="eyebrow">
            <span className="eyebrow__dot" />
            PS-19 · phishing, impostors &amp; fake shops
          </span>
          <h1>
            Look before
            <br />
            you <span className="ink-teal">click.</span>
          </h1>
          <p className="hero__lede">
            BlueHats scans a link like a skeptic — DNS, TLS, redirects, cloned branding, and reputation feeds — then explains
            the risk in language a human can act on.
          </p>
          <div className="hero__trust">
            <span>
              <Icon name="shield" size={15} />
              No sign-up
            </span>
            <span>
              <Icon name="scan" size={15} />
              Evidence-first
            </span>
            <span>
              <Icon name="download" size={15} />
              Exports stay on-device
            </span>
          </div>
        </div>
      </section>

      <section className="workbench shell" aria-label="Link scanner">
        <div className="workbench__form">
          <ScannerForm
            key={`${urlParam}-${formKey}`}
            status={status}
            demoCases={demoCases}
            activeDemo={activeDemo}
            initialUrl={urlParam}
            progress={progress}
            onSubmit={submit}
            onDemo={demo}
            onStop={abort}
          />
        </div>
        <div className="workbench__side">
          <Terminal logs={logs} status={status} host={result?.host} error={error?.message} />
          <div className="coverage">
            <div className="coverage__row">
              <Icon name="database" size={16} />
              <span>{coverage}</span>
            </div>
            <div className="coverage__row">
              <Icon name="lock" size={16} />
              <span>SSRF-guarded fetch · no JavaScript executed</span>
            </div>
            <div className="coverage__row">
              <Icon name="eye" size={16} />
              <span>Public pages only · private ranges blocked</span>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="shell">
          <div className="callout callout--error" role="alert">
            <Icon name="alert" size={20} />
            <div>
              <strong>The scan did not finish</strong>
              <p>{error.message}</p>
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => (lastInput.current ? runScan(lastInput.current) : handleReset())}
            >
              <Icon name="refresh" size={16} />
              Try again
            </button>
          </div>
        </div>
      ) : null}

      <div ref={resultRef} className="shell result-slot" aria-live="polite">
        {status === 'done' && result ? <ResultView result={result} onReset={handleReset} /> : null}
      </div>

      {recent.length ? (
        <section className="shell recent" aria-labelledby="recent-title">
          <div className="section-head">
            <div>
              <span className="eyebrow eyebrow--muted">On this device</span>
              <h2 id="recent-title">Recent scans</h2>
            </div>
            <Link to="/history" className="text-link">
              Open history
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
          <div className="recent__grid">
            {recent.slice(0, 3).map((entry) => (
              <button key={entry.id} type="button" className={`recent-card ${scoreClass(entry.score)}`} onClick={() => restoreEntry(entry)}>
                <div className="recent-card__top">
                  <span className={`score-dot ${scoreClass(entry.score)}`}>{entry.score}</span>
                  <span className="recent-card__verdict">{VERDICT_SHORT[entry.verdict]}</span>
                </div>
                <strong>{entry.host}</strong>
                <span className="recent-card__time">{formatDateTime(entry.scannedAt)}</span>
                <span className="recent-card__cta">
                  View report
                  <Icon name="arrow-right" size={14} />
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="shell how" aria-labelledby="how-title">
        <div className="section-head">
          <div>
            <span className="eyebrow eyebrow--muted">The short version</span>
            <h2 id="how-title">Three steps, no mystery meat</h2>
          </div>
          <Link to="/how-to" className="text-link">
            Read the full method
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="how__grid">
          {STEPS.map((step, index) => (
            <article key={step.title} className="how-card">
              <span className="how-card__number">{String(index + 1).padStart(2, '0')}</span>
              <span className="how-card__icon">
                <Icon name={step.icon} size={22} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell families" aria-labelledby="families-title">
        <div className="section-head">
          <div>
            <span className="eyebrow eyebrow--muted">Seven evidence families</span>
            <h2 id="families-title">Every score has receipts</h2>
          </div>
        </div>
        <div className="families__grid">
          {FAMILIES.map((family) => (
            <div key={family.label} className="family-chip">
              <Icon name={family.icon} size={18} />
              <div>
                <strong>{family.label}</strong>
                <span>{family.note}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="shell faq" aria-labelledby="faq-title">
        <div className="section-head">
          <div>
            <span className="eyebrow eyebrow--muted">Reasonable questions</span>
            <h2 id="faq-title">What people ask first</h2>
          </div>
        </div>
        <div className="faq__grid">
          {FAQ.map((item) => (
            <details key={item.question} className="faq__item">
              <summary>
                {item.question}
                <Icon name="chevron-down" size={16} />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="shell cta-band">
        <div>
          <span className="eyebrow eyebrow--light">Still holding a suspicious link?</span>
          <h2>Run it through the lamp.</h2>
          <p>No account. No extension. Just the evidence, in order.</p>
        </div>
        <button
          type="button"
          className="btn btn--cream btn--lg"
          onClick={() => {
            document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            navigate('/');
          }}
        >
          <Icon name="scan" size={19} />
          Scan a link
        </button>
      </section>
    </div>
  );
}
