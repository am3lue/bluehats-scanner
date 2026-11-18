import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type Tone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastApi {
  push: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<number[]>([]);

  const push = useCallback((message: string, tone: Tone = 'info') => {
    idRef.current += 1;
    const id = idRef.current;
    setItems((current) => [...current.slice(-3), { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
    timers.current.push(timer);
  }, []);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`} role="status">
            <Icon name={item.tone === 'success' ? 'check' : item.tone === 'error' ? 'alert' : 'info'} size={18} />
            <span>{item.message}</span>
            <button
              type="button"
              className="toast__close"
              aria-label="Dismiss notification"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
