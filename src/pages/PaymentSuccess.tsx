import { useEffect, useState, useRef } from 'react';
import { CheckCircle, ArrowRight, Lock, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PaymentSuccessProps {
  onNavigate: (page: string, param?: string | boolean) => void;
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 15; // 30 seconds total

export default function PaymentSuccess({ onNavigate }: PaymentSuccessProps) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>('pro');
  const [workspaceStatus, setWorkspaceStatus] = useState<'polling' | 'found' | 'timeout'>('polling');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const attemptsRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('plan');
    if (p) setPlan(p);
    history.replaceState(null, '', window.location.pathname);
  }, []);

  // Poll for the workspace that the Stripe webhook creates
  useEffect(() => {
    if (!user) return;

    async function poll() {
      attemptsRef.current += 1;

      const { data } = await supabase
        .from('workspace_members')
        .select('workspaces!inner(id, subscription_status, plan)')
        .eq('user_id', user!.id)
        .eq('role', 'owner')
        .in('workspaces.subscription_status', ['active', 'trialing'])
        .order('workspaces(created_at)', { ascending: false })
        .limit(1);

      const ws = (data?.[0] as { workspaces: { id: string } } | undefined)?.workspaces;
      if (ws?.id) {
        clearInterval(intervalRef.current!);
        setWorkspaceId(ws.id);
        setWorkspaceStatus('found');
        return;
      }

      if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
        clearInterval(intervalRef.current!);
        setWorkspaceStatus('timeout');
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);

  // Auto-navigate as soon as workspace is found
  useEffect(() => {
    if (workspaceStatus === 'found' && workspaceId) {
      onNavigate('workspace-hub', workspaceId);
    }
  }, [workspaceStatus, workspaceId]);

  const isEnterprise = plan === 'enterprise';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--app-bg)' }}>
      <div className="max-w-md w-full text-center">

        {/* Success icon */}
        <div className="relative inline-flex mb-6">
          <div
            className="w-20 h-20 flex items-center justify-center"
            style={{ background: 'var(--signal)', boxShadow: 'var(--shadow-signal)' }}
          >
            <CheckCircle className="w-10 h-10" style={{ color: 'var(--ink-900)' }} />
          </div>
          <div
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--positive)' }}
          >
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        </div>

        <h1 className="display-heading text-3xl mb-2">
          Welcome to {isEnterprise ? 'Enterprise' : 'Pro'}!
        </h1>

        {workspaceStatus === 'polling' ? (
          <div className="mb-8">
            <p className="text-sm mb-3" style={{ color: 'var(--app-text-secondary)' }}>
              Your subscription is confirmed. Setting up your workspace...
            </p>
            <div className="flex items-center justify-center gap-2 text-signal">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Opening workspace</span>
            </div>
          </div>
        ) : (
          <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
            Your subscription is active. You can now create private encrypted workspaces and collaborate with AI agents on your proprietary ideas.
          </p>
        )}

        {/* What's unlocked */}
        <div className="panel p-5 mb-6 text-left">
          <p className="section-label mb-3">What's unlocked</p>
          <ul className="space-y-2.5">
            {[
              { icon: Lock, text: 'Create private encrypted workspaces' },
              { icon: Sparkles, text: 'AI agents debate your proprietary ideas' },
              { icon: CheckCircle, text: isEnterprise ? 'Up to 25 workspace members' : 'Invite up to 3 team members' },
              ...(isEnterprise ? [{ icon: CheckCircle, text: 'Priority support & SLA guarantee' }] : []),
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--app-text-primary)' }}>
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--signal)' }} />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          {workspaceStatus === 'timeout' && (
            <button
              onClick={() => onNavigate('workspaces', true)}
              className="btn-primary w-full"
              style={{ padding: '0.875rem 1.25rem' }}
            >
              <Lock className="w-4 h-4" />
              Go to your workspace
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onNavigate('home')}
            className="btn-secondary w-full"
            style={{ padding: '0.75rem 1.25rem' }}
          >
            Back to home
          </button>
        </div>

      </div>
    </div>
  );
}
