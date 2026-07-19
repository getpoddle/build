import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  deriveAccessState,
  resolveSubscriptionTier,
  isMonthlyTrialLimitReached,
} from '../../supabase/functions/_shared/workspaceAccessLogic';

export interface WorkspaceAccess {
  canAccess: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isReadOnly: boolean;
  role: 'owner' | 'admin' | 'member' | null;
  plan: 'pro' | 'enterprise' | null;
  subscriptionStatus: string | null;
  trialExpiresAt: string | null;
  seatsUsed: number;
  seatsTotal: number;
  loading: boolean;
}

export function useWorkspaceAccess(workspaceId: string | null): WorkspaceAccess {
  const { user } = useAuth();
  const [state, setState] = useState<WorkspaceAccess>({
    canAccess: false,
    isOwner: false,
    isAdmin: false,
    isReadOnly: false,
    role: null,
    plan: null,
    subscriptionStatus: null,
    trialExpiresAt: null,
    seatsUsed: 0,
    seatsTotal: 0,
    loading: true,
  });

  useEffect(() => {
    if (!workspaceId || !user) {
      setState(s => ({ ...s, loading: false, canAccess: false }));
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [memberRes, workspaceRes, seatsRes] = await Promise.all([
          supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user!.id)
            .maybeSingle(),
          supabase
            .from('workspaces')
            .select('plan, subscription_status, seats, trial_workspace_expires_at')
            .eq('id', workspaceId)
            .maybeSingle(),
          supabase
            .from('workspace_members')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId),
        ]);

        if (cancelled) return;

        const role = memberRes.data?.role as 'owner' | 'admin' | 'member' | null ?? null;
        const workspace = workspaceRes.data;
        const access = deriveAccessState(role, workspace);

        setState({
          ...access,
          role,
          plan: workspace?.plan as 'pro' | 'enterprise' | null ?? null,
          subscriptionStatus: workspace?.subscription_status ?? null,
          trialExpiresAt: workspace?.trial_workspace_expires_at ?? null,
          seatsUsed: seatsRes.count ?? 0,
          seatsTotal: workspace?.seats ?? 0,
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState(s => ({ ...s, loading: false, canAccess: false }));
        }
      }
    }

    load();

    // Re-fetch whenever the workspace's subscription fields change server-side
    // (e.g. Stripe webhook sets subscription_status = 'active' after payment).
    const channel = supabase
      .channel(`workspace-access-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspaces',
          filter: `id=eq.${workspaceId}`,
        },
        () => { load(); }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [workspaceId, user]);

  return state;
}

export function useUserWorkspaces() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Array<{
    id: string;
    name: string;
    description: string;
    domain: string;
    plan: string;
    subscription_status: string;
    trial_workspace_expires_at: string | null;
    seats: number;
    is_encrypted: boolean;
    role: string;
    owner_id: string;
    stripe_customer_id: string | null;
    source: string;
    created_at: string;
    decision_category: string;
    decision_status: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('workspace_members')
      .select(`
        role,
        workspaces (
          id, name, description, domain, plan, subscription_status,
          trial_workspace_expires_at, seats, is_encrypted, owner_id, stripe_customer_id,
          source, created_at, decision_category, decision_status
        )
      `)
      .eq('user_id', user.id);

    const result = (data || [])
      .filter(row => row.workspaces)
      .map(row => ({
        ...(row.workspaces as Record<string, unknown>) as typeof workspaces[0],
        role: row.role,
      }));

    setWorkspaces(result);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return { workspaces, loading, refetch: () => { setLoading(true); load(); } };
}

export function useSubscriptionTier() {
  const { user } = useAuth();
  const [tier, setTier] = useState<'free' | 'pro' | 'team' | 'enterprise'>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setTier('free'); setLoading(false); return; }

    async function load() {
      // Profile tier is the authoritative source.
      // subscription_tier='pro'/'enterprise' is only ever set by the Stripe webhook
      // or an admin — never by client-side code — so it's safe to trust directly.
      const profileRes = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user!.id)
        .maybeSingle();

      const resolvedTier = resolveSubscriptionTier(profileRes.data?.subscription_tier);
      setTier(resolvedTier);
      setLoading(false);
    }

    load().catch(() => setLoading(false));
  }, [user]);

  return { tier, loading, isPro: tier === 'pro' || tier === 'team' || tier === 'enterprise' };
}

export interface WarRoomUsage {
  sessions_used: number;
  sessions_limit: number | null;
  included: number;
  in_overage: boolean;
  overage_count: number;
  overage_unit_price: number;
  hard_block: boolean;
  plan: string;
  period_end: string | null;
  warning_threshold_reached: boolean;
  limit_reached: boolean;
  loading: boolean;
}

export function useWarRoomUsage(workspaceId: string | null): WarRoomUsage & { refetch: () => Promise<void> } {
  const { user } = useAuth();
  const [state, setState] = useState<WarRoomUsage>({
    sessions_used: 0, sessions_limit: null, included: 0, in_overage: false,
    overage_count: 0, overage_unit_price: 0, hard_block: false, plan: 'free',
    period_end: null, warning_threshold_reached: false, limit_reached: false, loading: true,
  });

  async function load() {
    if (!workspaceId || !user) { setState(s => ({ ...s, loading: false })); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workspace-usage?workspace_id=${workspaceId}`,
        { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } }
      );
      if (!res.ok) { setState(s => ({ ...s, loading: false })); return; }
      const data = await res.json();
      setState({ ...data, loading: false });
    } catch {
      setState(s => ({ ...s, loading: false }));
    }
  }

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, user]);

  return { ...state, refetch: load };
}

export function useTrialInfo() {
  const { user } = useAuth();
  const [freeWorkspaceMonth, setFreeWorkspaceMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    supabase
      .from('profiles')
      .select('free_workspace_month')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFreeWorkspaceMonth(data?.free_workspace_month ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const now = new Date();
  const monthlyLimitReached = isMonthlyTrialLimitReached(freeWorkspaceMonth, now);

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetsOn = nextMonthDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const endOfMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const expiresOn = endOfMonthDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return {
    monthlyLimitReached,
    resetsOn,
    expiresOn,
    loading,
    // legacy aliases kept for backward compatibility
    trialExhausted: monthlyLimitReached,
    trialCount: monthlyLimitReached ? 1 : 0,
    trialSlotsRemaining: monthlyLimitReached ? 0 : 1,
  };
}
