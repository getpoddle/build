import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Key, Loader2, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';

interface InviteCodeEntryProps {
  onSuccess: () => void;
}

export default function InviteCodeEntry({ onSuccess }: InviteCodeEntryProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Please enter an invite code.'); return; }

    setSubmitting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setError('You must be signed in to redeem a code.'); return; }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/redeem-invite-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: trimmed }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error || 'Something went wrong. Please try again.');
        return;
      }

      setSuccess(true);
      setTimeout(() => onSuccess(), 1200);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-800">Beta access activated!</p>
          <p className="text-xs text-emerald-600 mt-0.5">60 days of full access — enjoy Poddle.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
            placeholder="BETA-XXXXXXXX"
            maxLength={32}
            className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-700 text-sm bg-white transition-all font-mono tracking-wider uppercase"
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 hover:-translate-y-px flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.25)' }}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          {submitting ? 'Redeeming…' : 'Redeem'}
        </button>
      </form>
      {error && (
        <div className="flex items-start gap-2 mt-2.5">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
