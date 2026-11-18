import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { TourProvider } from './components/Tour';
import { BootOverlay } from './components/BootOverlay';
import { BinaryBackdrop } from './components/BinaryBackdrop';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { DemoPage } from './pages/DemoPage';
import { HowToPage } from './pages/HowToPage';
import { DocsPage } from './pages/DocsPage';
import { HistoryPage } from './pages/HistoryPage';
import { NotFoundPage } from './pages/NotFoundPage';

function ScrollManager({ children }: { children: ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        window.setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.hash]);

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <TourProvider>
            <BinaryBackdrop />
            <ScrollManager>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/demo" element={<DemoPage />} />
                  <Route path="/how-to" element={<HowToPage />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </ScrollManager>
            <BootOverlay />
          </TourProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
