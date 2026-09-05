import { useState, useEffect } from 'react';
import { Building2, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface JoinOrganizationProps {
  token: string;
  onNavigate: (page: string) => void;
}

type Status = 'loading' | 'valid' | 'accepted' | 'already_member' | 'expired' | 'invalid' | 'error' | 'unauthenticated' | 'wrong_account';

interface InviteInfo {
  organization_id: string;
  organization_name: string;
  invited_email: string;
  inviter_full_name: string | null;
}

export default function JoinOrganization({ token, onNavigate }: JoinOrganizationProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    validateToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  async function validateToken() {
    setStatus('loading');
    try {
      const { data: rows, error } = await supabase.rpc('get_organization_invite_by_token', {
        p_token: token,
      });
      const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

      if (error || !data) { setStatus('invalid'); return; }
      if (new Date(data.expires_at) < new Date()) { setStatus('expired'); return; }

      setInvite({
        organization_id: data.organization_id,
        organization_name: data.organization_name,
        invited_email: data.invited_email,
        inviter_full_name: data.inviter_full_name,
      });

      if (!user) {
        sessionStorage.setItem('pendingOrgInviteToken', token);
        sessionStorage.setItem('postLoginRedirect', `#join-org/${token}`);
        setStatus('unauthenticated');
        return;
      }

      if (user.email?.toLowerCase() !== data.invited_email.toLowerCase()) {
        setStatus('wrong_account');
        return;
      }

      setStatus('valid');
    } catch {
      setStatus('error');
    }
  }

  async function handleAccept() {
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('accept_organization_invite', { p_token: token });
      if (error || data?.error) {
        setStatus('error');
        return;
      }
      setStatus(data?.already_member ? 'already_member' : 'accepted');
    } catch {
      setStatus('error');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--app-bg, #f8fafc)' }}>
      <div className="max-w-md w-full p-8 text-center" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
        <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(184,134,11,0.1)' }}>
          <Building2 className="w-7 h-7" style={{ color: '#b8860b' }} />
        </div>

        {status === 'loading' && (
          <p className="text-sm text-slate-500">Checking invite…</p>
        )}

        {status === 'valid' && invite && (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Join {invite.organization_name}</h1>
            <p className="text-sm text-slate-500 mb-6">
              {invite.inviter_full_name || 'Someone'} invited you to join <strong>{invite.organization_name}</strong> on Poddle AI.
            </p>
            <button
              onClick={handleAccept}
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white font-bold text-sm disabled:opacity-60"
              style={{ background: '#b8860b' }}
            >
              {joining ? 'Joining…' : 'Accept invitation'}
              {!joining && <ArrowRight className="w-4 h-4" />}
            </button>
          </>
        )}

        {status === 'unauthenticated' && invite && (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Join {invite.organization_name}</h1>
            <p className="text-sm text-slate-500 mb-6">
              Sign in or create an account with <strong>{invite.invited_email}</strong> to accept this invite.
            </p>
            <button
              onClick={() => onNavigate('auth')}
              className="w-full py-3 rounded-lg text-white font-bold text-sm"
              style={{ background: '#b8860b' }}
            >
              Sign in / Sign up
            </button>
          </>
        )}

        {status === 'wrong_account' && invite && (
          <>
            <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: '#d97706' }} />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Wrong account</h1>
            <p className="text-sm text-slate-500">
              This invite was sent to <strong>{invite.invited_email}</strong>. Sign out and sign in with that email to accept it.
            </p>
          </>
        )}

        {(status === 'accepted' || status === 'already_member') && invite && (
          <>
            <CheckCircle className="w-8 h-8 mx-auto mb-3" style={{ color: '#16a34a' }} />
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              {status === 'already_member' ? "You're already a member" : `Welcome to ${invite.organization_name}`}
            </h1>
            <button
              onClick={() => onNavigate('organization')}
              className="w-full py-3 rounded-lg text-white font-bold text-sm mt-4"
              style={{ background: '#b8860b' }}
            >
              Go to Organization
            </button>
          </>
        )}

        {status === 'expired' && (
          <>
            <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: '#d97706' }} />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Invite expired</h1>
            <p className="text-sm text-slate-500">Ask the organization owner to send you a new invite.</p>
          </>
        )}

        {(status === 'invalid' || status === 'error') && (
          <>
            <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: '#dc2626' }} />
            <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid invite link</h1>
            <p className="text-sm text-slate-500">This link may have already been used or is incorrect.</p>
          </>
        )}
      </div>
    </div>
  );
}
