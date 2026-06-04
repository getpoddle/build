import * as Sentry from '@sentry/react';

const DSN = 'https://8d0e7524fe9d1703f08c3bfb2635b38e@o4511509010972672.ingest.de.sentry.io/4511509037842512';

export function initSentry() {
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
  });
}

export { Sentry };
