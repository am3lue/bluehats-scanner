import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ScanResult } from '@server/types';
import { ApiError, submitReport } from '../lib/api';
import { saveLocalReport } from '../lib/storage';
import { Icon } from './Icon';
import { useToast } from './Toast';

interface ReportModalProps {
  result: ScanResult;
  onClose: () => void;
}

export function ReportModal({ result, onClose }: ReportModalProps) {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { push } = useToast();

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === 'saving') return;
    setStatus('saving');
    setMessage('');
    const payload = {
      url: result.inputUrl,
      host: result.host,
      verdict: result.verdict,
      score: result.score,
      note: note.trim().slice(0, 500),
    };
    try {
      const record = await submitReport(payload);
      saveLocalReport(record);
      setStatus('saved');
      push('Report queued for review.', 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `local-${Date.now()}`;
        const now = new Date().toISOString();
        saveLocalReport({
          id,
          url: payload.url,
          host: payload.host,
          verdict: payload.verdict,
          score: payload.score,
          note: payload.note,
          status: 'new',
          createdAt: now,
          updatedAt: now,
        });
        setStatus('saved');
        setMessage('The review API is unreachable, so this report was saved in this browser only.');
        push('Saved locally — review API unreachable.', 'info');
        return;
      }
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'The report could not be submitted.');
    }
  };

  return createPortal(
    <div className="modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal__card" role="dialog" aria-modal="true" aria-labelledby="report-title" aria-describedby="report-desc">
        <button ref={closeRef} type="button" className="modal__close" aria-label="Close report dialog" onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
        <span className="pill pill--sand">
          <Icon name="flag" size={14} />
          Human review queue
        </span>
        <h2 id="report-title">Send this scan for review</h2>
        <p id="report-desc">
          Reports are stored with the URL, verdict, score, and your note — nothing else. No account required.
        </p>

        <div className="modal__target">
          <Icon name="link" size={16} />
          <span>{result.inputUrl}</span>
          <span className="modal__score">risk {result.score}</span>
        </div>

        {status === 'saved' ? (
          <div className="modal__success" role="status">
            <Icon name="check" size={20} />
            <div>
              <strong>Report received</strong>
              <p>{message || 'Thanks — it is now in the review queue for a human to look at.'}</p>
            </div>
          </div>
        ) : (
          <form className="modal__form" onSubmit={submit}>
            <label htmlFor="report-note">What should the reviewer know? (optional)</label>
            <textarea
              id="report-note"
              ref={noteRef}
              value={note}
              maxLength={500}
              rows={4}
              placeholder="e.g. Received this link by text, it asked for my card details…"
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="modal__count">{note.length}/500</div>
            {status === 'error' ? (
              <p className="form-error" role="alert">
                <Icon name="alert" size={16} />
                {message}
              </p>
            ) : null}
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={status === 'saving'}>
                {status === 'saving' ? <span className="spinner" aria-hidden="true" /> : <Icon name="flag" size={17} />}
                {status === 'saving' ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}

        {status === 'saved' ? (
          <div className="modal__actions">
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
