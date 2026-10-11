import posthog from 'posthog-js';
import { supabase } from './supabase';
import { parseOwnProfileSensitive } from './profileSensitive';
import { hasAnalyticsConsent, onCookieConsentChange } from './cookieConsent';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  if (!POSTHOG_KEY) return;
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent()) {
    onCookieConsentChange((choice) => {
      if (choice === 'accepted') initPostHog();
    });
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    person_profiles: 'identified_only',
    persistence: 'localStorage+cookie',
    mask_all_text: false,
    session_recording: {
      maskAllInputs: true,
    },
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        ph.debug(false);
      }
    },
  });

  initialized = true;
}

export function isPostHogReady(): boolean {
  return initialized && !!POSTHOG_KEY;
}

export function phCapture(event: string, properties?: Record<string, unknown>) {
  if (!isPostHogReady()) return;
  posthog.capture(event, properties);
}

export function phIdentify(userId: string, properties?: Record<string, unknown>) {
  if (!isPostHogReady()) return;
  posthog.identify(userId, properties);
}

export function phSetPersonProperties(properties: Record<string, unknown>) {
  if (!isPostHogReady()) return;
  posthog.setPersonProperties(properties);
}

export function phReset() {
  if (!isPostHogReady()) return;
  posthog.reset();
}

export function phPageview(path: string, title?: string) {
  if (!isPostHogReady()) return;
  posthog.capture('$pageview', {
    $current_url: window.location.origin + path,
    path,
    title,
  });
}

export function phFeatureFlag(name: string): boolean | string | undefined {
  if (!isPostHogReady()) return undefined;
  return posthog.getFeatureFlag(name);
}

export async function phSyncProfileProperties(userId: string) {
  if (!isPostHogReady()) return;

  const [profileRes, sensitiveRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, country, location, onboarded, created_at, theme_preference')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .rpc('get_own_profile_sensitive')
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  if (!profile) return;
  const is_admin = parseOwnProfileSensitive(sensitiveRes.data)?.is_admin ?? false;

  const workspaceCount = await supabase.from('workspace_members').select('workspace_id', { count: 'exact', head: true }).eq('user_id', userId).then(r => r.count ?? 0);

  const accountAgeDays = profile.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000)
    : 0;

  posthog.setPersonProperties({
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
    country: profile.country ?? null,
    location: profile.location ?? null,
    is_admin,
    onboarded: !!profile.onboarded,
    theme_preference: profile.theme_preference ?? null,
    workspace_count: workspaceCount,
    account_age_days: accountAgeDays,
  });
}
