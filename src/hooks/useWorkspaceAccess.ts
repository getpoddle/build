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
      // Check profile tier and active workspace membership in parallel.
      // Workspace membership is the authoritative source — if the user owns
      // or is a member of any active pro/enterprise workspace, they are pro.
      const [profileRes, workspaceRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user!.id)
          .maybeSingle(),
        supabase
          .from('workspace_members')
          .select('workspaces!inner(plan, subscription_status)')
          .eq('user_id', user!.id)
          .in('workspaces.subscription_status', ['active', 'trialing'])
          .in('workspaces.plan', ['pro', 'enterprise'])
          .limit(1),
      ]);

      const profileTier = (profileRes.data?.subscription_tier as 'free' | 'pro' | 'enterprise') || 'free';

      // Determine the highest tier from workspace membership
      const activeWorkspaces = (workspaceRes.data || []) as Array<{ workspaces: { plan: string; subscription_status: string } }>;
      const hasActiveProWorkspace = activeWorkspaces.length > 0;
      const workspacePlan = activeWorkspaces[0]?.workspaces?.plan as 'pro' | 'enterprise' | undefined;

      let resolvedTier: 'free' | 'pro' | 'enterprise' = profileTier;
      if (hasActiveProWorkspace) {
        // Workspace membership takes precedence — escalate tier if needed
        if (workspacePlan === 'enterprise') resolvedTier = 'enterprise';
        else if (resolvedTier === 'free') resolvedTier = 'pro';
      }

      // If workspace says pro but profile is still free, sync it in the background
      if (resolvedTier !== 'free' && profileTier === 'free') {
        supabase
          .from('profiles')
          .update({ subscription_tier: resolvedTier })
          .eq('id', user!.id)
          .then(() => {})
          .catch(() => {});
      }

      setTier(resolvedTier);
      setLoading(false);
    }

    load().catch(() => setLoading(false));
  }, [user]);

  return { tier, loading, isPro: tier === 'pro' || tier === 'enterprise' };
}

export function useTrialInfo() {
  const { user } = useAuth();
  const [trialCount, setTrialCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    supabase
      .from('profiles')
      .select('trial_workspace_count')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setTrialCount(data?.trial_workspace_count ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const FREE_LIMIT = 2;
  return {
    trialCount,
    loading,
    trialSlotsRemaining: Math.max(0, FREE_LIMIT - trialCount),
    trialExhausted: trialCount >= FREE_LIMIT,
  };
}
