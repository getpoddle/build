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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
      <div className="max-w-md w-full text-center">

        {/* Success icon */}
        <div className="relative inline-flex mb-6">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 12px 40px rgba(37,99,235,0.35)' }}
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <div
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: '#16a34a', boxShadow: '0 2px 8px rgba(22,163,74,0.4)' }}
          >
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-slate-900 mb-2">
          Welcome to {isEnterprise ? 'Enterprise' : 'Pro'}!
        </h1>

        {workspaceStatus === 'polling' ? (
          <div className="mb-8">
            <p className="text-slate-500 text-sm mb-3">
              Your subscription is confirmed. Setting up your workspace...
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Opening workspace</span>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Your subscription is active. You can now create private encrypted workspaces and collaborate with AI agents on your proprietary ideas.
          </p>
        )}

        {/* What's unlocked */}
        <div
          className="rounded-2xl p-5 mb-6 text-left"
          style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}
        >
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">What's unlocked</p>
          <ul className="space-y-2.5">
            {[
              { icon: Lock, text: 'Create private encrypted workspaces' },
              { icon: Sparkles, text: 'AI agents debate your proprietary ideas' },
              { icon: CheckCircle, text: isEnterprise ? 'Up to 25 workspace members' : 'Invite up to 5 team members' },
              ...(isEnterprise ? [{ icon: CheckCircle, text: 'Priority support & SLA guarantee' }] : []),
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-slate-700">
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#2563eb' }} />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          {workspaceStatus === 'timeout' && (
            <button
              onClick={() => onNavigate('workspaces', true)}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}
            >
              <Lock className="w-4 h-4" />
              Go to your workspace
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onNavigate('home')}
            className="w-full py-3 rounded-2xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Back to home
          </button>
        </div>

      </div>
    </div>
  );
}
