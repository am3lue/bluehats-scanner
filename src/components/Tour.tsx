import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { markTourSeen } from '../lib/storage';
import { useToast } from './Toast';
import { Icon } from './Icon';

interface Step {
  target?: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'center';
}

const STEPS: Step[] = [
  {
    title: 'Welcome to BlueHats',
    body: 'A 30-second look at how the scanner works. You can leave the tour at any time — nothing you type is stored unless you scan it.',
    placement: 'center',
  },
  {
    target: '[data-tour="hero-form"]',
    title: 'Stick a link under the lamp',
    body: 'Paste any http or https URL. Optionally name the brand you expect so the scanner can measure lookalike distance.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="demo-chips"]',
    title: 'No link handy?',
    body: 'Six controlled demo fixtures exercise typosquatting, homoglyphs, redirect chains, cloned brands, and parked domains.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="hero-terminal"]',
    title: 'Watch the evidence arrive',
    body: 'Scans stream live: DNS, TLS, redirects, page content, brand signals, and reputation checks. Every logged step is exportable.',
    placement: 'top',
  },
  {
    target: '[data-tour="nav"]',
    title: 'The rest of the kit',
    body: 'Demo library, a step-by-step how-to, and the trust docs live up top. History stays in your browser.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="footer"]',
    title: 'Take the report with you',
    body: 'Export JSON, CSV, or a branded PDF. Results are heuristics — always verify through official channels before signing in.',
    placement: 'top',
  },
];

interface TourApi {
  start: () => void;
  stop: () => void;
  active: boolean;
}

const TourContext = createContext<TourApi | null>(null);

export function useTour(): TourApi {
  const context = useContext(TourContext);
  if (!context) throw new Error('useTour must be used inside TourProvider');
  return context;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 336;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const returnFocus = useRef<Element | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const stop = useCallback(() => {
    setActive(false);
    setBox(null);
  }, []);

  const finish = useCallback(
    (completed: boolean) => {
      markTourSeen();
      stop();
      push(completed ? 'Tour complete. Happy sleuthing.' : 'Tour closed.', 'info');
      if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus();
    },
    [push, stop],
  );

  const start = useCallback(() => {
    returnFocus.current = document.activeElement;
    const begin = () => {
      setIndex(0);
      setActive(true);
    };
    if (location.pathname !== '/') {
      navigate('/');
      window.setTimeout(begin, 420);
    } else {
      begin();
    }
  }, [location.pathname, navigate]);

  const step = STEPS[index];

  useEffect(() => {
    if (!active || !step) return;
    if (!step.target) {
      setBox(null);
      return;
    }
    let attempts = 0;
    let frame = 0;
    let scrollTimer = 0;

    const measure = () => {
      const element = document.querySelector(step.target!);
      if (!element) {
        if (attempts < 6) {
          attempts += 1;
          frame = window.setTimeout(measure, 130);
        } else if (index < STEPS.length - 1) {
          setIndex((current) => current + 1);
        } else {
          finish(true);
        }
        return;
      }
      const updated = () => {
        const rect = element.getBoundingClientRect();
        setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      };
      element.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      updated();
      scrollTimer = window.setTimeout(updated, 380);
    };

    const onViewport = () => {
      const element = document.querySelector(step.target!);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };

    frame = window.setTimeout(measure, 40);
    window.addEventListener('scroll', onViewport, true);
    window.addEventListener('resize', onViewport);
    return () => {
      window.clearTimeout(frame);
      window.clearTimeout(scrollTimer);
      window.removeEventListener('scroll', onViewport, true);
      window.removeEventListener('resize', onViewport);
    };
  }, [active, index, step, finish]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((current) => (current >= STEPS.length - 1 ? current : current + 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => nextRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [active, index]);

  const next = () => {
    if (index >= STEPS.length - 1) finish(true);
    else setIndex(index + 1);
  };

  const cardStyle = (() => {
    if (!box) return undefined;
    const left = clamp(box.left + box.width / 2 - CARD_WIDTH / 2, 16, Math.max(16, window.innerWidth - CARD_WIDTH - 16));
    if (step.placement === 'top') {
      return { left, bottom: Math.max(16, window.innerHeight - box.top + 14), width: CARD_WIDTH };
    }
    return { left, top: Math.min(window.innerHeight - 220, box.top + box.height + 14), width: CARD_WIDTH };
  })();

  return (
    <TourContext.Provider value={{ start, stop, active }}>
      {children}
      {active && step ? (
        <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
          <div className="tour__shade" aria-hidden="true" />
          {box ? (
            <div
              className="tour__spot"
              aria-hidden="true"
              style={{ top: box.top - 8, left: box.left - 8, width: box.width + 16, height: box.height + 16 }}
            />
          ) : null}
          <div
            className={`tour__card${box ? '' : ' tour__card--center'}${step.placement === 'top' ? ' tour__card--above' : ''}`}
            style={box ? cardStyle : undefined}
          >
            <div className="tour__meta">
              <span className="tour__count">
                Step {index + 1} / {STEPS.length}
              </span>
              <button type="button" className="tour__skip" onClick={() => finish(false)}>
                Skip tour
              </button>
            </div>
            <h2 id="tour-title">{step.title}</h2>
            <p>{step.body}</p>
            <div className="tour__actions">
              <div className="tour__dots" role="tablist" aria-label="Tour progress">
                {STEPS.map((entry, dotIndex) => (
                  <button
                    key={entry.title}
                    type="button"
                    role="tab"
                    aria-selected={dotIndex === index}
                    aria-label={`Step ${dotIndex + 1}`}
                    className={dotIndex === index ? 'is-active' : dotIndex < index ? 'is-done' : ''}
                    onClick={() => setIndex(dotIndex)}
                  />
                ))}
              </div>
              <div className="tour__buttons">
                {index > 0 ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIndex(index - 1)}>
                    Back
                  </button>
                ) : null}
                <button ref={nextRef} type="button" className="btn btn--primary btn--sm" onClick={next}>
                  {index >= STEPS.length - 1 ? 'Finish' : 'Next'}
                  <Icon name={index >= STEPS.length - 1 ? 'check' : 'arrow-right'} size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </TourContext.Provider>
  );
}
