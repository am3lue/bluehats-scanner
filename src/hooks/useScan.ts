import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogLine, ScanResult } from '@server/types';
import { ApiError, scanOnce, streamScan, type ScanInput } from '../lib/api';
import { saveScan } from '../lib/storage';

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

const PHASE_PROGRESS: Record<string, number> = {
  boot: 6,
  parse: 10,
  guard: 18,
  dns: 30,
  tls: 42,
  redirects: 52,
  fetch: 62,
  content: 72,
  brand: 80,
  reputation: 89,
  score: 96,
  done: 100,
};

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError) {
    return new ApiError('Could not reach the scanner API. Check that the server is running.', 0, 'network');
  }
  return new ApiError(error instanceof Error ? error.message : 'The scan failed unexpectedly.', 0, 'unknown');
}

export interface RunOptions {
  saveToHistory?: boolean;
}

export function useScanWorkbench() {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status !== 'scanning') return;
    const timer = window.setInterval(() => {
      setProgress((current) => (current >= 94 ? current : Math.min(94, current + 1)));
    }, 420);
    return () => window.clearInterval(timer);
  }, [status]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setLogs([]);
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setProgress(0);
  }, []);

  const run = useCallback(async (input: ScanInput, options: RunOptions = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('scanning');
    setLogs([]);
    setResult(null);
    setError(null);
    setProgress(4);

    const finish = (scan: ScanResult) => {
      if (!mountedRef.current || controller.signal.aborted) return;
      setResult(scan);
      setLogs(scan.logs);
      setStatus('done');
      setProgress(100);
      if (options.saveToHistory !== false) {
        try {
          saveScan(scan);
        } catch {
          /* history is best-effort */
        }
      }
    };

    try {
      const scan = await streamScan(
        input,
        {
          onLog: (log) => {
            if (!mountedRef.current || controller.signal.aborted) return;
            setLogs((current) => [...current.slice(-300), log]);
            const phaseProgress = PHASE_PROGRESS[log.phase];
            if (phaseProgress) setProgress((current) => Math.max(current, phaseProgress));
          },
        },
        controller.signal,
      );
      finish(scan);
    } catch (caught) {
      if (controller.signal.aborted || !mountedRef.current) return;
      const firstError = toApiError(caught);
      const retryable = firstError.status === 0 || firstError.status >= 500;
      if (retryable) {
        try {
          const scan = await scanOnce(input, controller.signal);
          finish(scan);
          return;
        } catch (retryError) {
          if (controller.signal.aborted || !mountedRef.current) return;
          setError(toApiError(retryError));
          setStatus('error');
          setProgress(0);
          return;
        }
      }
      setError(firstError);
      setStatus('error');
      setProgress(0);
    }
  }, []);

  return { status, logs, result, error, progress, run, reset, abort, setResult, setLogs, setStatus, setProgress, setError };
}
