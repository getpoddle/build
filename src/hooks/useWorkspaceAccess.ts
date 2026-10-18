import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { parseOwnProfileSensitive } from '../lib/profileSensitive';
import {
  deriveAccessState,
  resolveSubscriptionTier,
  isTrialLimitReached,
  TRIAL_WORKSPACE_LIMIT,
} from '../../supabase/functions/_shared/workspaceAccessLogic';

function useOwnProfileSensitive(userId: string | undefined) {
  return useQuery({
    queryKey: ['user', userId, 'own-profile-sensitive'],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_own_profile_sensitive').maybeSingle();
      if (error) throw error;
      return parseOwnProfileSensitive(data);
    },
  });
}

// Complimentary access is read from a security-definer RPC that only returns
// the current authenticated user's active grant. No email-based bypass.
export function useComplimentaryAccess() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['user', user?.id, 'complimentary-access'],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_complimentary_access');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      return (row?.plan === 'pro' || row?.plan === 'team' ||
              row?.plan === 'business' || row?.plan === 'enterprise')
        ? row.plan as 'pro' | 'team' | 'business' | 'enterprise' : null;
    },
  });
  return { plan: query.data ?? null, loading: !!user && query.isPending, error: query.error };
}

export interface WorkspaceAccess {
  canAccess: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isReadOnly: boolean;
  role: 'owner' | 'admin' | 'member' | null;
  plan: 'pro' | 'team' | 'business' | 'enterprise' | null;
  subscriptionStatus: string | null;
  trialExpiresAt: string | null;
  seatsUsed: number;
  seatsTotal: number;
  loading: boolean;
  error?: Error | null;
}

export function workspaceMetadataQuery(userId: string, workspaceId: string) {
  return {
    queryKey: ['user', userId, 'workspace', workspaceId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, description, domain, plan, subscription_status, owner_id, seats, trial_workspace_expires_at')
        .eq('id', workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}

export function useWorkspaceAccess(workspaceId: string | null): WorkspaceAccess {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const complimentary = useComplimentaryAccess();
  const accessQuery = useQuery({
    queryKey: ['user', user?.id, 'workspace-access', workspaceId],
    enabled: !!user && !!workspaceId,
    queryFn: async () => {
      const [memberRes, workspaceRes, seatsRes] = await Promise.all([
        supabase.from('workspace_members').select('role').eq('workspace_id', workspaceId!).eq('user_id', user!.id).maybeSingle(),
        queryClient.fetchQuery(workspaceMetadataQuery(user!.id, workspaceId!)),
        supabase.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId!),
      ]);
      if (memberRes.error) throw memberRes.error;
      if (seatsRes.error) throw seatsRes.error;
      const role = memberRes.data?.role as 'owner' | 'admin' | 'member' | null ?? null;
      const workspace = workspaceRes;
      return {
        ...deriveAccessState(role, workspace),
        role,
        plan: workspace?.plan as 'pro' | 'team' | 'business' | 'enterprise' | null ?? null,
        subscriptionStatus: workspace?.subscription_status ?? null,
        trialExpiresAt: workspace?.trial_workspace_expires_at ?? null,
        seatsUsed: seatsRes.count ?? 0,
        seatsTotal: workspace?.seats ?? 0,
        loading: false,
      } satisfies WorkspaceAccess;
    },
  });

  useEffect(() => {
    if (!workspaceId || !user) return;

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
        () => {
          void queryClient.invalidateQueries({ queryKey: ['user', user.id, 'workspace', workspaceId] })
            .then(() => queryClient.invalidateQueries({ queryKey: ['user', user.id, 'workspace-access', workspaceId] }));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` },
        () => { void queryClient.invalidateQueries({ queryKey: ['user', user.id, 'workspace-access', workspaceId] }); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, user, queryClient]);

  if (accessQuery.data) {
    const access = accessQuery.data;
    // Complimentary grants affect only a workspace owned by the grantee.
    // Membership and role checks remain unchanged.
    return complimentary.plan && access.isOwner
      ? { ...access, isReadOnly: false, plan: complimentary.plan }
      : access;
  }
  return {
    canAccess: false, isOwner: false, isAdmin: false, isReadOnly: false, role: null,
    plan: null, subscriptionStatus: null, trialExpiresAt: null, seatsUsed: 0,
    seatsTotal: 0, loading: !!user && !!workspaceId && accessQuery.isPending,
    error: (accessQuery.error as Error | null) ?? null,
  };
}

export function useUserWorkspaces() {
  const { user } = useAuth();
  const workspacesQuery = useQuery({
    queryKey: ['user', user?.id, 'workspaces'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          role,
          workspaces (
            id, name, description, domain, plan, subscription_status,
            trial_workspace_expires_at, seats, is_encrypted, owner_id, stripe_customer_id,
            source, created_at, decision_category, decision_status
          )
        `)
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data || [])
        .filter(row => row.workspaces)
        .map(row => {
          const workspace = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
          return { ...workspace, role: row.role } as WorkspaceSummary;
        });
    },
  });

  type WorkspaceSummary = {
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
  };
  return {
    workspaces: workspacesQuery.data ?? [],
    loading: !!user && workspacesQuery.isPending,
    error: workspacesQuery.error,
    refetch: () => workspacesQuery.refetch(),
  };
}

export function useSubscriptionTier() {
  const { user } = useAuth();
  const query = useOwnProfileSensitive(user?.id);
  const complimentary = useComplimentaryAccess();
  const tier = complimentary.plan ?? resolveSubscriptionTier(query.data?.subscription_tier);
  return { tier, loading: (!!user && query.isPending) || complimentary.loading, isPro: tier !== 'free', isComplimentary: !!complimentary.plan };
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
  const { user, session } = useAuth();
  const [state, setState] = useState<WarRoomUsage>({
    sessions_used: 0, sessions_limit: null, included: 0, in_overage: false,
    overage_count: 0, overage_unit_price: 0, hard_block: false, plan: 'free',
    period_end: null, warning_threshold_reached: false, limit_reached: false, loading: true,
  });

  async function load() {
    if (!workspaceId || !user) { setState(s => ({ ...s, loading: false })); return; }
    try {
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
  }, [workspaceId, user, session?.access_token]);

  return { ...state, refetch: load };
}

export function useTrialInfo() {
  const { user } = useAuth();
  const query = useOwnProfileSensitive(user?.id);
  const complimentary = useComplimentaryAccess();

  const now = new Date();
  const trialLimitReached = !complimentary.plan && isTrialLimitReached(query.data?.trial_workspace_count ?? null, now);
  const used = query.data?.trial_workspace_count ?? 0;
  const slotsRemaining = Math.max(0, TRIAL_WORKSPACE_LIMIT - used);

  return {
    trialLimitReached,
    trialCount: used,
    trialSlotsRemaining: slotsRemaining,
    trialLimit: TRIAL_WORKSPACE_LIMIT,
    loading: (!!user && query.isPending) || complimentary.loading,
    // legacy aliases kept for backward compatibility
    trialExhausted: trialLimitReached,
    monthlyLimitReached: trialLimitReached,
  };
}
