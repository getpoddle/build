import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export interface BetaAccessState {
  hasBetaAccess: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  loading: boolean;
  refetch: () => void;
}

export function useBetaAccess(): BetaAccessState {
  const { user, session } = useAuth();
  const query = useQuery({
    queryKey: ['user', user?.id, 'beta-access'],
    enabled: !!user && !!session?.access_token,
    queryFn: async () => {
      if (!session?.access_token) throw new Error('Session expired. Please sign in again.');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/check-beta-access`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error('Could not check beta access.');
      const json = await res.json();
      return {
        hasBetaAccess: !!json.hasBetaAccess,
        expiresAt: json.expiresAt ?? null,
        daysRemaining: json.daysRemaining ?? null,
      };
    },
  });

  return {
    hasBetaAccess: query.data?.hasBetaAccess ?? false,
    expiresAt: query.data?.expiresAt ?? null,
    daysRemaining: query.data?.daysRemaining ?? null,
    loading: !!user && query.isPending,
    refetch: () => { void query.refetch(); },
  };
}
