import { supabase } from './supabase';

// Temporary debug instrumentation for the tab-disappearing bug.
// Fire-and-forget inserts to the debug_logs table. Never throws, never blocks.
// Strip this file (and its call sites) once the bug is resolved.

export async function debugLog(
  eventType: string,
  payload: Record<string, unknown>,
  workspaceId?: string,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    supabase
      .from('debug_logs')
      .insert({
        user_id: user?.id ?? null,
        workspace_id: workspaceId ?? null,
        event_type: eventType,
        payload,
      })
      .then(() => {}, () => {});
  } catch {
    // swallow — debug logging must never break the app
  }
}
