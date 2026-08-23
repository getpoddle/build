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

// After a new deploy, a browser tab that's already open may try to fetch an
// old lazy-loaded chunk (e.g. Organization-<oldhash>.js) that no longer
// exists on the server. This throws a dynamic-import failure that looks
// like a random crash and can leave the app in a broken, half-reloaded
// state. Detect that specific failure and force one clean reload instead —
// guarded so a real repeated crash doesn't reload-loop forever.
function isStaleChunkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('importing a module script failed') ||
    (m.includes('failed to fetch') && m.includes('chunk'))
  );
}

function handleStaleChunk(message: string): boolean {
  if (!isStaleChunkError(message)) return false;
  const key = 'poddle_stale_chunk_reload';
  if (sessionStorage.getItem(key)) return false; // already tried once this session, don't loop
  sessionStorage.setItem(key, '1');
  window.location.reload();
  return true;
}

window.addEventListener('error', (event) => {
  const stack = event.error?.stack || event.message || '(no stack)';
  if (handleStaleChunk(event.message || '')) return;
  console.error('[GlobalError] window.onerror:', event.message, '\n', stack);
  logGlobalError('window.onerror', event.message, stack);
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : '(no stack)';
  if (handleStaleChunk(msg)) return;
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
