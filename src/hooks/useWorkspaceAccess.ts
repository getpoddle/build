import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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

      setState({
        canAccess: !!role,
        isOwner: role === 'owner',
        isAdmin: role === 'owner' || role === 'admin',
        isReadOnly: workspace?.subscription_status === 'inactive',
        role,
        plan: workspace?.plan as 'pro' | 'enterprise' | null ?? null,
        subscriptionStatus: workspace?.subscription_status ?? null,
        trialExpiresAt: workspace?.trial_workspace_expires_at ?? null,
        seatsUsed: seatsRes.count ?? 0,
        seatsTotal: workspace?.seats ?? 0,
        loading: false,
      });
    }

    load();
    return () => { cancelled = true; };
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
          trial_workspace_expires_at, seats, is_encrypted, owner_id, stripe_customer_id
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
  const [tier, setTier] = useState<'free' | 'pro' | 'enterprise'>('free');
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

      const resolvedTier = (profileRes.data?.subscription_tier as 'free' | 'pro' | 'enterprise') || 'free';
      setTier(resolvedTier);
      setLoading(false);
    }

    load().catch(() => setLoading(false));
  }, [user]);

  return { tier, loading, isPro: tier === 'pro' || tier === 'team' || tier === 'enterprise' };
}

export function useTrialInfo() {
  const { user } = useAuth();
  const [trialCount, setTrialCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // Count workspaces the user owns by going through workspace_members (role='owner'),
    // since the workspaces RLS SELECT policy is is_workspace_member(), not owner_id=auth.uid().
    // Querying workspaces directly by owner_id returns empty for non-service-role clients.
    Promise.all([
      supabase
        .from('profiles')
        .select('trial_workspace_count')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('role', 'owner'),
    ]).then(([profileRes, wsCountRes]) => {
      const stored = profileRes.data?.trial_workspace_count ?? 0;
      const actual = wsCountRes.count ?? 0;
      setTrialCount(Math.max(stored, actual));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const FREE_LIMIT = 2;
  return {
    trialCount,
    loading,
    trialSlotsRemaining: Math.max(0, FREE_LIMIT - trialCount),
    trialExhausted: trialCount >= FREE_LIMIT,
  };
}
