import { useEffect, useRef, useState } from 'react';
import type { ScanResult } from '@server/types';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { copyText } from '../lib/format';
import { exportLogsCsv, exportLogsJson, exportResultJson, reportSummaryText } from '../lib/exports';
import { exportPdf } from '../lib/pdf';

export function ExportMenu({ result }: { result: ScanResult }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { push } = useToast();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePdf = async () => {
    setBusy(true);
    setOpen(false);
    try {
      await exportPdf(result);
      push('PDF report downloaded.', 'success');
    } catch {
      push('The PDF could not be generated in this browser.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    setOpen(false);
    try {
      await copyText(reportSummaryText(result));
      push('Summary copied to your clipboard.', 'success');
    } catch {
      push('Clipboard access was blocked.', 'error');
    }
  };

  return (
    <div className="export" ref={wrapRef}>
      <button
        type="button"
        className="btn btn--primary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        disabled={busy}
      >
        <Icon name="download" size={18} />
        {busy ? 'Building PDF…' : 'Export report'}
        <Icon name="chevron-down" size={16} />
      </button>
      {open ? (
        <div className="export__menu" role="menu">
          <button type="button" role="menuitem" onClick={handlePdf}>
            <Icon name="file" size={17} />
            <span>
              Branded PDF
              <small>Summary, signals, sources</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              exportResultJson(result);
              push('JSON report downloaded.', 'success');
            }}
          >
            <Icon name="code" size={17} />
            <span>
              Full JSON
              <small>Every raw field, portable</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              exportLogsCsv(result);
              push('CSV log downloaded.', 'success');
            }}
          >
            <Icon name="clipboard" size={17} />
            <span>
              Scan log CSV
              <small>Timestamped evidence trail</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              exportLogsJson(result);
              push('JSON log downloaded.', 'success');
            }}
          >
            <Icon name="terminal" size={17} />
            <span>
              Scan log JSON
              <small>For SIEM or notebook import</small>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={handleCopy}>
            <Icon name="copy" size={17} />
            <span>
              Copy summary
              <small>Plain-text verdict</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
