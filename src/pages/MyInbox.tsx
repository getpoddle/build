import { useState, useEffect, useCallback } from 'react';
import {
  Inbox, CheckCircle2, X, Clock, Copy, Settings,
  AlertCircle, Loader2, Zap, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CreateWorkspace from '../components/CreateWorkspace';

interface Submission {
  id: string;
  decision: string;
  options: string;
  context: string;
  submitter_name: string | null;
  status: 'pending' | 'running' | 'complete' | 'declined';
  created_at: string;
  brief_id?: string | null;
  brief_token?: string | null;
}

interface InboxProfile {
  inbox_slug: string | null;
  inbox_active: boolean;
  inbox_display_name: string | null;
  inbox_bio: string | null;
  username: string | null;
  full_name: string | null;
}

interface MyInboxProps {
  onNavigate: (page: string, id?: string) => void;
}

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://poddleme.com';

function MyInbox({ onNavigate }: MyInboxProps) {
  const { user } = useAuth();

  const [profile, setProfile] = useState<InboxProfile | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'settings'>('queue');

  // Settings form state
  const [slug, setSlug] = useState('');
  const [active, setActive] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [slugError, setSlugError] = useState('');

  const [copied, setCopied] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<Submission | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);

    const [profileRes, submissionsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('inbox_slug, inbox_active, inbox_display_name, inbox_bio, username, full_name')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('inbox_submissions')
        .select(`
          id, decision, options, context, submitter_name, status, created_at,
          inbox_briefs(id, share_token)
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (profileRes.data) {
      const p = profileRes.data as InboxProfile;
      setProfile(p);
      setSlug(p.inbox_slug || p.username || '');
      setActive(p.inbox_active);
      setDisplayName(p.inbox_display_name || p.full_name || '');
      setBio(p.inbox_bio || '');
    }

    if (submissionsRes.data) {
      const mapped: Submission[] = submissionsRes.data.map((row: {
        id: string;
        decision: string;
        options: string;
        context: string;
        submitter_name: string | null;
        status: 'pending' | 'running' | 'complete' | 'declined';
        created_at: string;
        inbox_briefs: Array<{ id: string; share_token: string }> | null;
      }) => ({
        id: row.id,
        decision: row.decision,
        options: row.options,
        context: row.context,
        submitter_name: row.submitter_name,
        status: row.status,
        created_at: row.created_at,
        brief_id: row.inbox_briefs?.[0]?.id ?? null,
        brief_token: row.inbox_briefs?.[0]?.share_token ?? null,
      }));
      setSubmissions(mapped);
    }

    setLoadingData(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDecline(submissionId: string) {
    await supabase
      .from('inbox_submissions')
      .update({ status: 'declined' })
      .eq('id', submissionId);
    setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'declined' } : s));
  }

  function handleRunWarRoom(submission: Submission) {
    setPendingSubmission(submission);
  }

  function launchWarRoom(submission: Submission, workspaceId: string) {
    const context = [
      `Decision: ${submission.decision}`,
      submission.options ? `Options: ${submission.options}` : '',
      submission.context ? `Context: ${submission.context}` : '',
      submission.submitter_name ? `Submitted by: ${submission.submitter_name}` : '',
    ].filter(Boolean).join('\n\n');

    sessionStorage.setItem('inboxSubmissionContext', context);
    sessionStorage.setItem('inboxSubmissionId', submission.id);
    sessionStorage.setItem('inboxAutoTab', 'war-room');
    setPendingSubmission(null);
    onNavigate('workspace-hub', workspaceId);
  }

  function copyLink() {
    const link = `${APP_URL}/#inbox/${slug}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function saveSettings() {
    if (!user) return;
    setSlugError('');
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanSlug) { setSlugError('Slug cannot be empty.'); return; }

    setSavingSettings(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        inbox_slug: cleanSlug,
        inbox_active: active,
        inbox_display_name: displayName.trim() || null,
        inbox_bio: bio.trim() || null,
      })
      .eq('id', user.id);

    setSavingSettings(false);
    if (error) {
      if (error.message.includes('unique')) {
        setSlugError('That slug is already taken. Try another.');
      } else {
        setSlugError('Failed to save. Please try again.');
      }
      return;
    }
    setSlug(cleanSlug);
    setProfile(p => p ? { ...p, inbox_slug: cleanSlug, inbox_active: active, inbox_display_name: displayName || null, inbox_bio: bio || null } : p);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  }

  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const inboxUrl = slug ? `${APP_URL}/#inbox/${slug}` : null;

  if (loadingData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}>
            <Inbox className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Decision Inbox</h1>
            {pendingCount > 0 && (
              <p className="text-xs text-blue-600 font-semibold">{pendingCount} pending</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {inboxUrl && active && (
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-all"
              style={{ background: copied ? 'rgba(22,163,74,0.1)' : 'rgba(37,99,235,0.08)', color: copied ? '#16a34a' : '#2563eb' }}
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          )}
          <button
            onClick={() => setActiveTab(activeTab === 'queue' ? 'settings' : 'queue')}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-all"
            style={{ background: 'rgba(15,23,42,0.06)', color: '#64748b' }}
          >
            <Settings className="w-3.5 h-3.5" />
            {activeTab === 'queue' ? 'Settings' : 'Queue'}
          </button>
        </div>
      </div>

      {/* Inbox not active banner */}
      {!active && activeTab === 'queue' && (
        <div
          className="flex items-center gap-3 rounded-2xl p-4 mb-6"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Your inbox is inactive</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Enable it in{' '}
              <button className="underline font-semibold" onClick={() => setActiveTab('settings')}>Settings</button>
              {' '}to start receiving submissions.
            </p>
          </div>
        </div>
      )}

      {/* Queue tab */}
      {activeTab === 'queue' && (
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <div className="text-center py-16">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.08)' }}
              >
                <Inbox className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No submissions yet</p>
              {inboxUrl && active && (
                <p className="text-xs text-slate-400 mt-2">Share your link to start receiving decisions.</p>
              )}
            </div>
          ) : (
            submissions.map(sub => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                onDecline={() => handleDecline(sub.id)}
                onRunWarRoom={() => handleRunWarRoom(sub)}
                onViewBrief={sub.brief_token ? () => onNavigate('inbox-brief', sub.brief_token!) : undefined}
              />
            ))
          )}
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <div className="space-y-5">
          {/* Active toggle */}
          <div
            className="flex items-center justify-between rounded-2xl p-5"
            style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">Accept submissions</p>
              <p className="text-xs text-slate-500 mt-0.5">When active, anyone with your link can submit a decision.</p>
            </div>
            <button onClick={() => setActive(v => !v)} className="flex-shrink-0">
              {active
                ? <ToggleRight className="w-8 h-8 text-blue-600" />
                : <ToggleLeft className="w-8 h-8 text-slate-400" />}
            </button>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Your inbox slug</label>
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(15,23,42,0.12)' }}
            >
              <span className="px-3 py-3 text-sm text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap">
                poddle.me/inbox/
              </span>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="yourname"
                className="flex-1 px-3 py-3 text-sm text-slate-900 bg-white focus:outline-none"
              />
            </div>
            {slugError && <p className="text-xs text-red-500 mt-1.5">{slugError}</p>}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="How you appear to submitters"
              className="w-full rounded-xl px-4 py-3 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              style={{ border: '1px solid rgba(15,23,42,0.12)' }}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Bio <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={2}
              placeholder="e.g. I help founders think through hard decisions using AI."
              className="w-full rounded-xl px-4 py-3 text-sm text-slate-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              style={{ border: '1px solid rgba(15,23,42,0.12)' }}
            />
          </div>

          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: '#2563eb' }}
          >
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {settingsSaved ? 'Saved!' : savingSettings ? 'Saving…' : 'Save settings'}
          </button>

          {/* Inbox link preview */}
          {slug && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.12)' }}>
              <p className="text-xs text-slate-500 mb-1">Your inbox link</p>
              <p className="text-sm font-semibold text-blue-600 break-all">{APP_URL}/#inbox/{slug.toLowerCase().replace(/[^a-z0-9_-]/g, '')}</p>
            </div>
          )}
        </div>
      )}

      {pendingSubmission && (
        <CreateWorkspace
          onClose={() => setPendingSubmission(null)}
          onCreated={(workspaceId) => launchWarRoom(pendingSubmission, workspaceId)}
          onNavigatePricing={() => { setPendingSubmission(null); onNavigate('pricing'); }}
          initialName={pendingSubmission.decision.slice(0, 60)}
          initialDescription={[
            pendingSubmission.options ? `Options: ${pendingSubmission.options}` : '',
            pendingSubmission.context ? `Context: ${pendingSubmission.context}` : '',
            pendingSubmission.submitter_name ? `Submitted by: ${pendingSubmission.submitter_name}` : '',
          ].filter(Boolean).join('\n').slice(0, 500)}
        />
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface SubmissionCardProps {
  submission: Submission;
  onDecline: () => void;
  onRunWarRoom: () => void;
  onViewBrief?: () => void;
}

function SubmissionCard({ submission, onDecline, onRunWarRoom, onViewBrief }: SubmissionCardProps) {
  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'rgba(37,99,235,0.08)', text: '#2563eb', label: 'Pending' },
    running: { bg: 'rgba(245,158,11,0.1)', text: '#b45309', label: 'Running' },
    complete: { bg: 'rgba(22,163,74,0.1)', text: '#16a34a', label: 'Complete' },
    declined: { bg: 'rgba(239,68,68,0.08)', text: '#dc2626', label: 'Declined' },
  };
  const sc = statusColors[submission.status];

  return (
    <div
      className="rounded-2xl p-5 transition-all"
      style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
            {submission.decision}
          </p>
          {submission.submitter_name && (
            <p className="text-xs text-slate-400 mt-1">from {submission.submitter_name}</p>
          )}
        </div>
        <span
          className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: sc.bg, color: sc.text }}
        >
          {sc.label}
        </span>
      </div>

      {submission.options && (
        <p className="text-xs text-slate-500 mb-1 line-clamp-1">
          <span className="font-semibold">Options:</span> {submission.options}
        </p>
      )}
      {submission.context && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">
          <span className="font-semibold">Context:</span> {submission.context}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          {timeAgo(submission.created_at)}
        </div>

        <div className="flex items-center gap-2">
          {submission.status === 'complete' && onViewBrief && (
            <button
              onClick={onViewBrief}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
              style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              View brief
            </button>
          )}
          {submission.status === 'pending' && (
            <>
              <button
                onClick={onDecline}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
              >
                <X className="w-3.5 h-3.5" />
                Decline
              </button>
              <button
                onClick={onRunWarRoom}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl text-white transition-all"
                style={{ background: '#2563eb' }}
              >
                <Zap className="w-3.5 h-3.5" />
                Run War Room
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyInbox;
