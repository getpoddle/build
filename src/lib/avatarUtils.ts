import { supabase } from './supabase';

export function getAvatarUrl(avatarPath: string | null, bustCache: boolean = false): string | null {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('http')) return avatarPath;

  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);

  // Add cache-busting parameter to force refresh
  if (bustCache) {
    const url = new URL(data.publicUrl);
    url.searchParams.set('t', Date.now().toString());
    return url.toString();
  }

  return data.publicUrl;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
