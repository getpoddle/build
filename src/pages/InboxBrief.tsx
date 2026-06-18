import { useState, useEffect } from 'react';
import {
  Loader2, AlertCircle, CheckCircle2, TrendingUp,
  AlertTriangle, Lightbulb, HelpCircle, ArrowRight, Copy, Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SynthesisData {
  consensus_points?: Array<{ text: string; confidence: number }>;
  conflict_zones?: Array<{ topic: string; tension_level: number }>;
  risk_signals?: Array<{ signal: string; severity: string }>;
  blind_spots?: Array<{ area: string; description: string }>;
  action_items?: Array<{ text: string; priority: string }>;
  opportunity_signals?: Array<{ title: string; description: string }>;
  decision_health_score?: number;
  health_rationale?: string;
}

interface BriefData {
  id: string;
  submission_id: string;
  owner_id: string;
  share_token: string;
  synthesis: SynthesisData;
  owner_note: string | null;
  visibility: 'private' | 'shared';
  created_at: string;
  owner_name: string | null;
  owner_display_name: string | null;
  owner_avatar: string | null;
  owner_slug: string | null;
  submission_decision: string;
  submission_options: string;
  submission_context: string;
  is_pro_brief: boolean;
}

interface InboxBriefProps {
  token: string;
  onNavigate?: (page: string) => void;
}

const FREE_AGENTS = ['The Skeptic', 'Risk Analyst', 'The Optimist'];

function HealthScoreDial({ score, isPro }: { score: number; isPro: boolean }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Caution' : 'At Risk';
  return (
    <div className="flex flex-col items-center justify-center py-6">
      {isPro ? (
        <>
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center mb-3"
            style={{ background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
          >
            <div
              className="w-20 h-20 rounded-full flex flex-col items-center justify-center"
              style={{ background: '#1e293b' }}
            >
              <span className="text-2xl font-black text-white leading-none">{score}</span>
              <span className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Decision Health Score</p>
        </>
      ) : (
        <div
          className="flex items-center gap-3 rounded-2xl px-5 py-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Lock className="w-5 h-5 text-slate-500" />
          <div>
            <p className="text-sm font-semibold text-white">Decision Health Score</p>
            <p className="text-xs text-slate-500">Available on Pro</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxBrief({ token, onNavigate }: InboxBriefProps) {
  const { user } = useAuth();
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      // Fetch brief + join submission and owner profile
      const { data: briefRow, error } = await supabase
        .from('inbox_briefs')
        .select(`
          id, submission_id, owner_id, share_token, synthesis,
          owner_note, visibility, created_at,
          inbox_submissions(decision, options, context),
          profiles!owner_id(full_name, inbox_display_name, avatar_url, inbox_slug, subscription_tier)
        `)
        .eq('share_token', token)
        .eq('visibility', 'shared')
        .maybeSingle();

      if (error || !briefRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const sub = briefRow.inbox_submissions as { decision: string; options: string; context: string } | null;
      const ownerProfile = briefRow.profiles as { full_name: string | null; inbox_display_name: string | null; avatar_url: string | null; inbox_slug: string | null; subscription_tier: string } | null;

      setBrief({
        id: briefRow.id,
        submission_id: briefRow.submission_id,
        owner_id: briefRow.owner_id,
        share_token: briefRow.share_token,
        synthesis: (briefRow.synthesis as SynthesisData) || {},
        owner_note: briefRow.owner_note,
        visibility: briefRow.visibility as 'private' | 'shared',
        created_at: briefRow.created_at,
        owner_name: ownerProfile?.full_name ?? null,
        owner_display_name: ownerProfile?.inbox_display_name ?? null,
        owner_avatar: ownerProfile?.avatar_url ?? null,
        owner_slug: ownerProfile?.inbox_slug ?? null,
        submission_decision: sub?.decision ?? '',
        submission_options: sub?.options ?? '',
        submission_context: sub?.context ?? '',
        is_pro_brief: (ownerProfile?.subscription_tier === 'pro' || ownerProfile?.subscription_tier === 'enterprise'),
      });
      setLoading(false);
    }
    load();
  }, [token]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
            <AlertCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Brief not found</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            This brief may have been made private or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const { synthesis, is_pro_brief } = brief!;
  const ownerName = brief!.owner_display_name || brief!.owner_name || 'Someone';
  const healthScore = synthesis.decision_health_score ?? 0;

  // Gate: free briefs only show 3 consensus points and 3 risk signals
  const consensusPoints = is_pro_brief
    ? (synthesis.consensus_points ?? [])
    : (synthesis.consensus_points ?? []).slice(0, 3);
  const riskSignals = is_pro_brief
    ? (synthesis.risk_signals ?? [])
    : (synthesis.risk_signals ?? []).slice(0, 2);
  const actionItems = is_pro_brief ? (synthesis.action_items ?? []) : [];
  const blindSpots = is_pro_brief ? (synthesis.blind_spots ?? []) : [];
  const opportunities = is_pro_brief ? (synthesis.opportunity_signals ?? []) : [];

  const severityColor = (s: string) =>
    s === 'critical' || s === 'high' ? '#f87171' : s === 'medium' ? '#fbbf24' : '#94a3b8';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2">
          {brief!.owner_avatar ? (
            <img src={brief!.owner_avatar} alt={ownerName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
              style={{ background: 'linear-gradient(135deg, #2563eb, #0ea5e9)' }}
            >
              {ownerName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-white leading-none">{ownerName}</p>
            <p className="text-xs text-slate-500 mt-0.5">Decision Brief</p>
          </div>
        </div>

        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: copied ? '#4ade80' : '#94a3b8' }}
        >
          <Copy className="w-3.5 h-3.5" />
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>

      <div className="max-w-xl mx-auto w-full px-5 py-8 flex-1">
        {/* Decision */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">The Decision</p>
          <p className="text-base font-semibold text-white leading-snug mb-3">{brief!.submission_decision}</p>
          {brief!.submission_options && (
            <p className="text-sm text-slate-400 leading-relaxed">
              <span className="text-slate-500 font-semibold">Options: </span>
              {brief!.submission_options}
            </p>
          )}
          {brief!.submission_context && (
            <p className="text-sm text-slate-400 leading-relaxed mt-2">
              <span className="text-slate-500 font-semibold">Context: </span>
              {brief!.submission_context}
            </p>
          )}
        </div>

        {/* Owner note */}
        {brief!.owner_note && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}
          >
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">{ownerName}'s note</p>
            <p className="text-sm text-slate-300 leading-relaxed italic">"{brief!.owner_note}"</p>
          </div>
        )}

        {/* Health score */}
        <HealthScoreDial score={healthScore} isPro={is_pro_brief} />

        {/* Consensus */}
        {consensusPoints.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4" style={{ color: '#4ade80' }} />
              <h2 className="text-sm font-bold text-white">Where the agents agree</h2>
            </div>
            <div className="space-y-2">
              {consensusPoints.map((pt, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-sm text-slate-300 leading-relaxed">{pt.text}</p>
                  {pt.confidence > 0 && (
                    <p className="text-xs text-slate-500 mt-1">{pt.confidence}% confidence</p>
                  )}
                </div>
              ))}
              {!is_pro_brief && (synthesis.consensus_points?.length ?? 0) > 3 && (
                <LockedRow label={`+${(synthesis.consensus_points?.length ?? 0) - 3} more points`} />
              )}
            </div>
          </section>
        )}

        {/* Risk signals */}
        {riskSignals.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Risks flagged</h2>
            </div>
            <div className="space-y-2">
              {riskSignals.map((r, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span
                    className="flex-shrink-0 mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                    style={{ background: `${severityColor(r.severity)}18`, color: severityColor(r.severity) }}
                  >
                    {r.severity}
                  </span>
                  <p className="text-sm text-slate-300 leading-relaxed">{r.signal}</p>
                </div>
              ))}
              {!is_pro_brief && (synthesis.risk_signals?.length ?? 0) > 2 && (
                <LockedRow label={`+${(synthesis.risk_signals?.length ?? 0) - 2} more risks`} />
              )}
            </div>
          </section>
        )}

        {/* Opportunities — Pro only */}
        {is_pro_brief && opportunities.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Opportunities spotted</h2>
            </div>
            <div className="space-y-2">
              {opportunities.map((o, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-sm font-semibold text-white mb-1">{o.title}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{o.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Blind spots — Pro only */}
        {is_pro_brief && blindSpots.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Blind spots</h2>
            </div>
            <div className="space-y-2">
              {blindSpots.map((b, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-sm font-semibold text-white mb-1">{b.area}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action items — Pro only */}
        {is_pro_brief && actionItems.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-white">Recommended next steps</h2>
            </div>
            <div className="space-y-2">
              {actionItems.map((a, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="text-xs font-bold text-slate-500 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-slate-300 leading-relaxed">{a.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Free upgrade prompt */}
        {!is_pro_brief && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-bold text-white">Full brief requires Pro</p>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Upgrade to share briefs with the full 7-agent analysis, health score, opportunities, blind spots, and action items.
            </p>
          </div>
        )}

        {/* Footer CTA */}
        <div
          className="rounded-2xl p-5 text-center mt-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs text-slate-500 mb-1">This analysis was run on Poddle.</p>
          <a
            href="/#pricing"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white mt-3 px-5 py-3 rounded-xl transition-all"
            style={{ background: '#2563eb' }}
          >
            Run your own War Room free
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Logged-in owner: save brief & share controls */}
        {user && brief && user.id === brief.owner_id && (
          <OwnerBriefControls briefId={brief.id} shareToken={brief.share_token} currentNote={brief.owner_note} />
        )}
      </div>
    </div>
  );
}

function LockedRow({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-2"
      style={{ background: 'rgba(37,99,235,0.06)', border: '1px dashed rgba(37,99,235,0.2)' }}
    >
      <Lock className="w-3.5 h-3.5 text-blue-400" />
      <p className="text-xs text-blue-400 font-semibold">{label} — Pro only</p>
    </div>
  );
}

function OwnerBriefControls({ briefId, shareToken, currentNote }: { briefId: string; shareToken: string; currentNote: string | null }) {
  const [note, setNote] = useState(currentNote || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save() {
    setSaving(true);
    await supabase
      .from('inbox_briefs')
      .update({ owner_note: note.trim() || null, visibility: 'shared' })
      .eq('id', briefId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyShareLink() {
    const url = `${window.location.origin}/#brief/${shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="rounded-2xl p-5 mt-6"
      style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)' }}
    >
      <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Your note (optional)</p>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={2}
        placeholder="Add a personal note before sharing…"
        className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: '#2563eb' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saved ? 'Saved & shared!' : saving ? 'Saving…' : 'Save & share brief'}
        </button>
        <button
          onClick={copyShareLink}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', color: copied ? '#4ade80' : '#94a3b8' }}
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
