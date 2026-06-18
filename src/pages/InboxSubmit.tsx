import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2, AlertCircle, Inbox } from 'lucide-react';

interface InboxOwner {
  id: string;
  inbox_display_name: string | null;
  full_name: string | null;
  inbox_bio: string | null;
  avatar_url: string | null;
  inbox_active: boolean;
}

interface InboxSubmitProps {
  slug: string;
}

type SubmitState = 'idle' | 'submitting' | 'done' | 'error';

export default function InboxSubmit({ slug }: InboxSubmitProps) {
  const [owner, setOwner] = useState<InboxOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [decision, setDecision] = useState('');
  const [options, setOptions] = useState('');
  const [context, setContext] = useState('');
  const [name, setName] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, inbox_display_name, full_name, inbox_bio, avatar_url, inbox_active')
        .eq('inbox_slug', slug.toLowerCase())
        .maybeSingle();

      if (!data || !data.inbox_active) {
        setNotFound(true);
      } else {
        setOwner(data as InboxOwner);
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!owner || !decision.trim()) return;

    setSubmitState('submitting');
    setErrorMsg('');

    const { error } = await supabase.from('inbox_submissions').insert({
      owner_id: owner.id,
      decision: decision.trim(),
      options: options.trim(),
      context: context.trim(),
      submitter_name: name.trim() || null,
      status: 'pending',
    });

    if (error) {
      setErrorMsg('Something went wrong. Please try again.');
      setSubmitState('error');
    } else {
      setSubmitState('done');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f172a' }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <Inbox className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Inbox not found</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            This inbox doesn't exist or is no longer accepting submissions.
          </p>
        </div>
      </div>
    );
  }

  if (submitState === 'done') {
    const displayName = owner?.inbox_display_name || owner?.full_name || 'them';
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f172a' }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: '#4ade80' }} />
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Submitted</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your decision has been sent to {displayName}. They'll run it through their AI panel and share the analysis back with you.
          </p>
        </div>
      </div>
    );
  }

  const displayName = owner?.inbox_display_name || owner?.full_name || 'this person';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-8 pb-6 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3">
          {owner?.avatar_url ? (
            <img src={owner.avatar_url} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #2563eb, #0ea5e9)' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{displayName}</p>
            <p className="text-slate-500 text-xs">Decision Inbox</p>
          </div>
        </div>
        <div
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: 'rgba(37,99,235,0.12)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.2)' }}
        >
          Powered by Poddle
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-xl mx-auto w-full px-6 pb-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white leading-snug mb-3">
            Submit a decision
          </h1>
          {owner?.inbox_bio ? (
            <p className="text-slate-400 text-sm leading-relaxed">{owner.inbox_bio}</p>
          ) : (
            <p className="text-slate-400 text-sm leading-relaxed">
              {displayName} will run your decision through an AI panel and share the analysis with you.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Decision */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              What decision are you facing? <span style={{ color: '#f87171' }}>*</span>
            </label>
            <textarea
              value={decision}
              onChange={e => setDecision(e.target.value)}
              required
              rows={3}
              placeholder="e.g. Should we launch in Europe now or wait until Q1?"
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Options */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              What options are you considering?
            </label>
            <textarea
              value={options}
              onChange={e => setOptions(e.target.value)}
              rows={2}
              placeholder="e.g. Option A: hire a local sales lead. Option B: partner with a distributor."
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Context */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              What context matters?
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              rows={3}
              placeholder="e.g. We have 8 months of runway, two enterprise pilots already running in Germany, and a team of 12."
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Your name <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="So they know who submitted this"
              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>

          {submitState === 'error' && (
            <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitState === 'submitting' || !decision.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #2563eb, #0ea5e9)' }}
          >
            {submitState === 'submitting' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
            ) : (
              'Submit decision'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-8">
          No account required. Your submission is private.
        </p>
      </div>
    </div>
  );
}
