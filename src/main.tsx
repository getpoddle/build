import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';
import { initCapacitor, isNative } from './lib/capacitor';
import { initPostHog } from './lib/posthog';
import { initSentry } from './lib/sentry';

initSentry();
initPostHog();

// ─── Global error logger ───────────────────────────────────────────────────
// Captures errors that escape React's error boundaries (e.g. async callbacks,
// event handlers, setTimeout callbacks) so we get a stack trace when the
// "AI Collaboration tab disappears" bug reproduces.
const TAG = '[GlobalError]';
window.addEventListener('error', (event) => {
  const stack = event.error?.stack || event.message || '(no stack)';
  console.error(TAG, 'window.onerror:', event.message, '\n', stack);
  try { Sentry.captureException(event.error || event.message); } catch { /* noop */ }
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : '(no stack)';
  console.error(TAG, 'unhandledrejection:', msg, '\n', stack);
  try { Sentry.captureException(reason); } catch { /* noop */ }
});
// Also patch console.error so we can see what React logs when the tab vanishes
const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  origConsoleError(...args);
  // Tag React's internal error logging so it's easy to find in the Console
  const first = args[0];
  if (typeof first === 'string' && (first.includes('ErrorBoundary') || first.includes('PageErrorBoundary') || first.includes('crash'))) {
    origConsoleError(TAG, 'React-tagged error above');
  }
};

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
