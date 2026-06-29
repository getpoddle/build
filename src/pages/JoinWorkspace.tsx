import { useState, useEffect } from 'react';
import { Lock, CheckCircle, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface JoinWorkspaceProps {
  token: string;
  onNavigate: (page: string, workspaceId?: string) => void;
}

type Status = 'loading' | 'valid' | 'accepted' | 'already_member' | 'expired' | 'invalid' | 'error' | 'unauthenticated' | 'wrong_account';

interface InviteInfo {
  workspace_id: string;
  invited_email: string;
  expires_at: string;
  workspace: { name: string; description: string; plan: string };
  inviter: { full_name: string | null; email: string };
}

async function callAcceptInvite(accessToken: string, token: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/accept-workspace-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token }),
  });
  return res.json();
}

export default function JoinWorkspace({ token, onNavigate }: JoinWorkspaceProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [joining, setJoining] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    validateToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  async function validateToken() {
    setStatus('loading');
    try {
      // Use REST API directly with anon key so unauthenticated visitors can
      // read the invite — the token itself is the proof of authorisation.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(
        `${supabaseUrl}/rest/v1/workspace_invites?token=eq.${token}&select=workspace_id,invited_email,expires_at,accepted_at,workspaces(name,description,plan),profiles!workspace_invites_invited_by_fkey(full_name,email)`,
        {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Accept': 'application/json',
          },
        }
      );
      const rows = await res.json();
      const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

      if (!res.ok || !data) { setStatus('invalid'); return; }
      if (new Date(data.expires_at) < new Date()) { setStatus('expired'); return; }

      const info: InviteInfo = {
        workspace_id: data.workspace_id,
        invited_email: data.invited_email,
        expires_at: data.expires_at,
        workspace: Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces as InviteInfo['workspace'],
        inviter: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles as InviteInfo['inviter'],
      };
      setInvite(info);
      setWorkspaceId(data.workspace_id);

      if (!user) {
        // Save token so we can auto-accept after login/signup
        sessionStorage.setItem('pendingInviteToken', token);
        sessionStorage.setItem('postLoginRedirect', `#join/${token}`);
        setStatus('unauthenticated');
        return;
      }

      // If user just logged in, check if they're already a member
      const { data: existing } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', data.workspace_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) { setStatus('already_member'); return; }

      // If invite was previously accepted, check if this user accepted it
      if (data.accepted_at) { setStatus('accepted'); return; }

      setStatus('valid');
    } catch {
      setStatus('error');
    }
  }

  async function handleJoin() {
    if (!user || !invite) return;
    setJoining(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setStatus('error'); return; }

      const json = await callAcceptInvite(session.access_token, token);

      if (json.already_member) {
        setWorkspaceId(json.workspace_id);
        setStatus('already_member');
        return;
      }
      if (json.error === 'Invite already accepted') {
        setWorkspaceId(json.workspace_id);
        setStatus('accepted');
        return;
      }
      if (json.error && (json.error as string).includes('different email')) {
        setStatus('wrong_account');
        return;
      }
      if (json.error) {
        setStatus('error');
        return;
      }

      setWorkspaceId(json.workspace_id);
      sessionStorage.removeItem('pendingInviteToken');
      setStatus('accepted');
    } catch {
      setStatus('error');
    } finally {
      setJoining(false);
    }
  }

  const containerClass = "min-h-screen flex items-center justify-center p-4";
  const cardStyle = { boxShadow: '0 24px 64px rgba(15,23,42,0.15)', border: '1px solid rgba(15,23,42,0.08)' };

  if (status === 'loading') {
    return (
      <div className={containerClass} style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Validating invite…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className={containerClass} style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center" style={cardStyle}>
          <div
            className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">
            You're invited to <span className="text-blue-700">{invite?.workspace?.name}</span>
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Sign in or create a free account to accept this invitation and join the private workspace.
          </p>
          <button
            onClick={() => onNavigate('auth')}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}
          >
            <Sparkles className="w-4 h-4" />
            Sign in to accept
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-center text-xs text-slate-400 mt-3">
            Don't have an account? Sign up on the next screen.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className={containerClass} style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center" style={cardStyle}>
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(245,158,11,0.1)' }}>
            <AlertTriangle className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Invite expired</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            This invite link has expired. Ask the workspace owner to send you a new invitation.
          </p>
          <button onClick={() => onNavigate('home')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Go to home
          </button>
        </div>
      </div>
    );
  }

  if (status === 'invalid' || status === 'error') {
    return (
      <div className={containerClass} style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center" style={cardStyle}>
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Invalid invite</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            This invite link is not valid or something went wrong. Please try again or request a new invite.
          </p>
          <button onClick={() => onNavigate('home')} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Go to home
          </button>
        </div>
      </div>
    );
  }

  if (status === 'already_member') {
    return (
      <div className={containerClass} style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center" style={cardStyle}>
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(22,163,74,0.1)' }}>
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">You're already a member</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            You already have access to <strong>{invite?.workspace?.name}</strong>.
          </p>
          <button
            onClick={() => onNavigate('workspace-hub', workspaceId || invite?.workspace_id)}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            Open Workspace <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className={containerClass} style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center" style={cardStyle}>
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(22,163,74,0.1)' }}>
            <CheckCircle className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Welcome aboard!</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            You've joined <strong>{invite?.workspace?.name}</strong>. Your team's private workspace is ready.
          </p>
          <button
            onClick={() => onNavigate('workspace-hub', workspaceId || invite?.workspace_id)}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}
          >
            Open Workspace <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (status === 'wrong_account') {
    return (
      <div className={containerClass} style={{ background: '#f8fafc' }}>
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center" style={cardStyle}>
          <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Wrong account</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-2">
            This invite was sent to <strong>{invite?.invited_email}</strong>.
          </p>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Please sign in with that email address to accept this invitation.
          </p>
          <button onClick={() => onNavigate('auth')} className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
            Sign in with the correct account
          </button>
        </div>
      </div>
    );
  }

  // status === 'valid'
  return (
    <div className={containerClass} style={{ background: '#f8fafc' }}>
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden" style={cardStyle}>
        <div
          className="px-8 pt-8 pb-6"
          style={{ background: 'linear-gradient(160deg,#1e3a5f 0%,#0f2040 100%)' }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-black text-white mb-1">You're invited</h2>
          <p className="text-slate-300 text-sm">
            {invite?.inviter?.full_name || invite?.inviter?.email} invited you to join a private workspace.
          </p>
        </div>

        <div className="px-8 py-6">
          <div className="mb-5 p-4 rounded-2xl" style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.07)' }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Workspace</p>
            <p className="text-base font-black text-slate-900">{invite?.workspace?.name}</p>
            {invite?.workspace?.description && (
              <p className="text-sm text-slate-500 mt-1">{invite.workspace.description}</p>
            )}
            <span
              className="inline-block mt-2 text-xs font-bold px-2.5 py-1 rounded-full capitalize"
              style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}
            >
              {invite?.workspace?.plan} plan
            </span>
          </div>

          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}
          >
            {joining ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Lock className="w-4 h-4" /> Accept & Join Workspace <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
          <p className="text-center text-xs text-slate-400 mt-3">Invite sent to {invite?.invited_email}</p>
        </div>
      </div>
    </div>
  );
}
