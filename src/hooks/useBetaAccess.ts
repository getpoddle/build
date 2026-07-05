import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface BetaAccessState {
  hasBetaAccess: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  loading: boolean;
  refetch: () => void;
}

export function useBetaAccess(): BetaAccessState {
  const { user } = useAuth();
  const [hasBetaAccess, setHasBetaAccess] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!user) {
      setHasBetaAccess(false);
      setExpiresAt(null);
      setDaysRemaining(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setHasBetaAccess(false);
        setLoading(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/check-beta-access`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        setHasBetaAccess(false);
        setLoading(false);
        return;
      }

      const json = await res.json();
      setHasBetaAccess(!!json.hasBetaAccess);
      setExpiresAt(json.expiresAt ?? null);
      setDaysRemaining(json.daysRemaining ?? null);
    } catch {
      setHasBetaAccess(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    check();
  }, [check]);

  return { hasBetaAccess, expiresAt, daysRemaining, loading, refetch: check };
}
