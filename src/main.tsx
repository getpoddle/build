import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';
import { initCapacitor, isNative } from './lib/capacitor';
import { initPostHog } from './lib/posthog';
import { initSentry } from './lib/sentry';
import { logGlobalError } from './lib/tabDiagnostics';

initSentry();
initPostHog();

window.addEventListener('error', (event) => {
  const stack = event.error?.stack || event.message || '(no stack)';
  console.error('[GlobalError] window.onerror:', event.message, '\n', stack);
  logGlobalError('window.onerror', event.message, stack);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : '(no stack)';
  console.error('[GlobalError] unhandledrejection:', msg, '\n', stack);
  logGlobalError('unhandledrejection', msg, stack);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

initCapacitor();

if (!isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {});
  });
}
