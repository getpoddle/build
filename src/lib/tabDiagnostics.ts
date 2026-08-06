import { Sentry } from './sentry';

export type TabValue = 'chat' | 'warroom' | 'team';
export type RealtimeSource = 'WorkspaceChat' | 'TeamChat';
export type RealtimeEvent =
  | 'postgres_insert'
  | 'broadcast_new_message'
  | 'broadcast_typing'
  | 'broadcast_recording'
  | 'channel_acquired'
  | 'channel_released'
  | 'poll_fallback';

let sequence = 0;
function nextSeq(): number {
  return ++sequence;
}

function ts(): string {
  return new Date().toISOString();
}

export function logTabChange(
  from: TabValue | null,
  to: TabValue,
  trigger: string,
  workspaceId: string,
): void {
  const seq = nextSeq();
  const data = {
    seq,
    timestamp: ts(),
    from,
    to,
    trigger,
    workspaceId,
  };

  Sentry.addBreadcrumb({
    category: 'tab',
    message: `tab change: ${from ?? 'null'} → ${to} (${trigger})`,
    level: 'info',
    data,
  });

  Sentry.captureMessage(`[TAB] ${from ?? 'null'} → ${to} (${trigger})`, {
    level: 'info',
    extra: data,
    tags: { workspaceId, from: from ?? 'null', to, trigger },
  });
}

export function logRealtimeEvent(
  source: RealtimeSource,
  event: RealtimeEvent,
  workspaceId: string,
  detail?: Record<string, unknown>,
): void {
  const seq = nextSeq();
  const data = {
    seq,
    timestamp: ts(),
    source,
    event,
    workspaceId,
    ...detail,
  };

  Sentry.addBreadcrumb({
    category: 'realtime',
    message: `[${source}] ${event}`,
    level: 'info',
    data,
  });
}

export function logBoundaryCatch(
  boundary: 'App' | 'Page',
  error: Error,
  componentStack?: string,
): void {
  const seq = nextSeq();
  Sentry.addBreadcrumb({
    category: 'boundary',
    message: `[${boundary}Boundary] caught: ${error.message}`,
    level: 'error',
    data: { seq, timestamp: ts(), error: error.message, componentStack },
  });
  Sentry.captureException(error, {
    tags: { boundary },
    extra: { componentStack, seq, timestamp: ts() },
  });
}

export function logGlobalError(
  kind: 'window.onerror' | 'unhandledrejection',
  message: string,
  stack?: string,
): void {
  const seq = nextSeq();
  Sentry.addBreadcrumb({
    category: 'global-error',
    message: `[${kind}] ${message}`,
    level: 'error',
    data: { seq, timestamp: ts(), message, stack },
  });
  Sentry.captureMessage(`[GLOBAL] ${kind}: ${message}`, {
    level: 'error',
    extra: { stack, seq, timestamp: ts() },
  });
}
