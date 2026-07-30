import posthog from 'posthog-js';
import { supabase } from './supabase';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  if (!POSTHOG_KEY) return;
  if (typeof window === 'undefined') return;

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

export async function phFireActivation(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  if (!isPostHogReady()) return;

  const { data, error } = await supabase
    .from('posthog_activations')
    .insert({ user_id: userId, event })
    .select()
    .maybeSingle();

  if (error || !data) return;

  posthog.capture(event, { ...properties, activation: true });
}

export async function phSyncProfileProperties(userId: string) {
  if (!isPostHogReady()) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, first_name, last_name, country, location, verified, is_admin, referral_tier, referral_points, onboarded, created_at, theme_preference')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) return;

  const [postCount, workspaceCount, followerCount, followingCount] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', userId).then(r => r.count ?? 0),
    supabase.from('workspace_members').select('workspace_id', { count: 'exact', head: true }).eq('user_id', userId).then(r => r.count ?? 0),
    supabase.from('followers').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId).then(r => r.count ?? 0),
    supabase.from('followers').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId).then(r => r.count ?? 0),
  ]);

  const accountAgeDays = profile.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000)
    : 0;

  posthog.setPersonProperties({
    username: profile.username ?? null,
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
    country: profile.country ?? null,
    location: profile.location ?? null,
    verified: !!profile.verified,
    is_admin: !!profile.is_admin,
    referral_tier: profile.referral_tier ?? null,
    referral_points: profile.referral_points ?? 0,
    onboarded: !!profile.onboarded,
    theme_preference: profile.theme_preference ?? null,
    post_count: postCount,
    workspace_count: workspaceCount,
    follower_count: followerCount,
    following_count: followingCount,
    account_age_days: accountAgeDays,
  });
}
