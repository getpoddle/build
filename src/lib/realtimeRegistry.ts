import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Maximum concurrent Supabase Realtime channels across the whole tab.
// Supabase free tier allows 200 concurrent connections per project; we budget
// 20 per tab so that even a power user with many workspaces open doesn't
// exhaust the limit.
const MAX_CHANNELS = 20;

interface RegistryEntry {
  channel: RealtimeChannel;
  refCount: number;
  subscribed: boolean;
}

// Module-level singleton — one instance per browser tab.
const registry = new Map<string, RegistryEntry>();

function totalChannels(): number {
  return registry.size;
}

/**
 * Acquire a channel by name.
 * - If the channel already exists in the registry, increment its ref count
 *   and return the existing channel (no duplicate WebSocket subscriptions).
 * - If the channel is new and we are under the cap, create and subscribe it.
 * - If we are at the cap, returns null — callers must degrade gracefully.
 *
 * `factory` receives the bare `RealtimeChannel` so the caller can attach
 * `.on(...)` handlers before the channel is subscribed.
 */
export function acquireChannel(
  name: string,
  factory: (ch: RealtimeChannel) => RealtimeChannel,
): RealtimeChannel | null {
  const existing = registry.get(name);
  if (existing) {
    existing.refCount++;
    return existing.channel;
  }

  if (totalChannels() >= MAX_CHANNELS) {
    console.warn(`[realtimeRegistry] Channel cap (${MAX_CHANNELS}) reached. Cannot open "${name}".`);
    return null;
  }

  const raw = supabase.channel(name);
  const configured = factory(raw);
  configured.subscribe();

  registry.set(name, { channel: configured, refCount: 1, subscribed: true });
  return configured;
}

/**
 * Release a channel by name.
 * Decrements the ref count; when it reaches zero the channel is unsubscribed
 * and removed from the registry.
 */
export function releaseChannel(name: string): void {
  const entry = registry.get(name);
  if (!entry) return;

  entry.refCount--;
  if (entry.refCount <= 0) {
    supabase.removeChannel(entry.channel);
    registry.delete(name);
  }
}

/**
 * Temporarily unsubscribe a channel without releasing it from the registry.
 * Used when the tab becomes hidden to reduce server-side broadcast load.
 * The ref count and handlers are preserved; call `resumeChannel` to resubscribe.
 */
export function pauseChannel(name: string): void {
  const entry = registry.get(name);
  if (!entry || !entry.subscribed) return;
  entry.channel.unsubscribe();
  entry.subscribed = false;
}

/**
 * Resubscribe a previously paused channel.
 */
export function resumeChannel(name: string): void {
  const entry = registry.get(name);
  if (!entry || entry.subscribed) return;
  entry.channel.subscribe();
  entry.subscribed = true;
}
