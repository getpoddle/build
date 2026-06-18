import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock, Settings, ArrowLeft,
  MessageSquare, Zap, RefreshCw, Loader2, AlertTriangle, Sparkles, Clock, Inbox, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useWorkspaceAccess } from '../hooks/useWorkspaceAccess';
import WorkspaceChat from '../components/WorkspaceChat';
import WorkspaceWarRoom, { WarRoomLockedState } from '../components/WorkspaceWarRoom';
import UpgradePrompt from '../components/UpgradePrompt';

type MainTab = 'entities' | 'chat';

interface Workspace {
  id: string;
  name: string;
  description: string;
  domain: string;
  plan: string;
  subscription_status: string;
  owner_id: string;
}

interface WorkspaceHubProps {
  workspaceId: string;
  onBack: () => void;
  onSettings: () => void;
  onNavigate: (page: string, id?: string) => void;
  onEntityClick?: (id: string, type: string) => void;
}

export default function WorkspaceHub({ workspaceId, onBack, onSettings, onNavigate }: WorkspaceHubProps) {
  const { user } = useAuth();
  const { canAccess, isAdmin, isReadOnly, plan, subscriptionStatus, trialExpiresAt, loading: accessLoading } = useWorkspaceAccess(workspaceId);
  // War Room is available when the workspace itself is on pro/enterprise,
  // regardless of the individual member's personal subscription tier.
  const workspaceIsPro = (plan === 'pro' || plan === 'enterprise') &&
    (subscriptionStatus === 'active' || subscriptionStatus === 'trialing');

  // Days remaining on trial
  const daysLeft = trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const isTrial = subscriptionStatus === 'trialing';
  const expiryWarning = daysLeft !== null && daysLeft <= 7 && !isReadOnly;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>(() => {
    const auto = sessionStorage.getItem('inboxAutoTab');
    if (auto === 'war-room') {
      sessionStorage.removeItem('inboxAutoTab');
      return 'entities';
    }
    return 'chat';
  });
  const [inboxSubmissionId, setInboxSubmissionId] = useState<string | null>(() => {
    const id = sessionStorage.getItem('inboxSubmissionId');
    return id || null;
  });
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>(() => {
    const ctx = sessionStorage.getItem('inboxSubmissionContext');
    if (ctx) {
      sessionStorage.removeItem('inboxSubmissionContext');
      return ctx;
    }
    return undefined;
  });
  const [showResynthesisNudge, setShowResynthesisNudge] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [warRoomKey, setWarRoomKey] = useState(0);
  const fromWarRoomRef = useRef(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [discussedKeys, setDiscussedKeys] = useState<Set<string>>(new Set());
  const [savingBrief, setSavingBrief] = useState(false);
  const [briefSaved, setBriefSaved] = useState(false);

  async function saveBriefFromSynthesis(synthesis: Record<string, unknown>) {
    if (!user || !inboxSubmissionId) return;
    setSavingBrief(true);
    const { data } = await supabase
      .from('inbox_briefs')
      .insert({
        submission_id: inboxSubmissionId,
        owner_id: user.id,
        synthesis,
        visibility: 'private',
      })
      .select('share_token')
      .maybeSingle();
    // Mark submission as complete
    await supabase
      .from('inbox_submissions')
      .update({ status: 'complete' })
      .eq('id', inboxSubmissionId);
    sessionStorage.removeItem('inboxSubmissionId');
    setInboxSubmissionId(null);
    setSavingBrief(false);
    setBriefSaved(true);
    if (data?.share_token) {
      onNavigate('inbox-brief', data.share_token);
    }
  }

  function handleDiscuss(prompt: string) {
    fromWarRoomRef.current = true;
    setPendingPrompt(prompt);
    setShowResynthesisNudge(false);
    setMainTab('chat');
  }

  function handleAgentsReplied() {
    if (fromWarRoomRef.current) {
      fromWarRoomRef.current = false;
      setShowResynthesisNudge(true);
    }
  }

  async function handleResynthesis() {
    setResyncing(true);
    setShowResynthesisNudge(false);
    // Switch to War Room tab immediately so the user sees the loading state
    setMainTab('entities');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      let res: Response | null = null;
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/workspace-synthesize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ workspace_id: workspaceId }),
          signal: controller.signal,
        });
      } catch {
        // Network or abort — War Room already visible, will show stale data
        return;
      } finally {
        clearTimeout(timeout);
      }

      let json: { error?: string } = {};
      try { json = await res.json(); } catch { /* non-critical */ }

      if (!json.error) {
        // Increment key to remount War Room and pull fresh data from DB.
        // Clear discussed keys — after re-synthesis items may have changed.
        setWarRoomKey(k => k + 1);
        setDiscussedKeys(new Set());
      }
    } finally {
      setResyncing(false);
    }
  }

  const fetchWorkspace = useCallback(async () => {
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();
    setWorkspace(data);
  }, [workspaceId]);

  useEffect(() => {
    if (!accessLoading && canAccess) {
      fetchWorkspace();
      setLoading(false);
    } else if (!accessLoading && !canAccess) {
      setLoading(false);
    }
  }, [accessLoading, canAccess, fetchWorkspace]);

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f8fafc' }}>
        <div className="text-center max-w-sm">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(15,23,42,0.05)' }}
          >
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Private Workspace</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            This workspace is invite-only. Ask an owner or admin to send you an invitation.
          </p>
          <button onClick={onBack} className="mt-6 text-sm font-semibold text-blue-600 hover:text-blue-700">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white transition-all border"
              style={{ borderColor: 'rgba(15,23,42,0.1)' }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
            >
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">{workspace?.name || 'Private Workspace'}</h1>
              {workspace?.description && (
                <p className="text-xs text-slate-500 mt-0.5">{workspace.description}</p>
              )}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={onSettings}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 border hover:bg-white transition-all"
              style={{ borderColor: 'rgba(15,23,42,0.1)' }}
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          )}
        </div>

        {/* Trial expiry warning banner */}
        {expiryWarning && (
          <div
            className="mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#b45309' }} />
            <p className="text-sm flex-1" style={{ color: '#92400e' }}>
              <span className="font-bold">Trial expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}.</span>
              {' '}Upgrade to keep this workspace and its War Room active.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#b45309,#d97706)' }}
            >
              Upgrade
            </button>
          </div>
        )}

        {/* Expired read-only banner */}
        {isReadOnly && (
          <div
            className="mb-5 rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: 'rgba(239,68,68,0.06)' }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <p className="text-sm flex-1 text-red-700">
                <span className="font-bold">Trial expired — this workspace is read-only.</span>
                {' '}Your data is safe. Upgrade to restore full access and create new content.
              </p>
              <button
                onClick={() => setShowUpgrade(true)}
                className="text-xs font-bold px-3 py-1.5 rounded-xl text-white flex-shrink-0 flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
              >
                <Sparkles className="w-3 h-3" />
                Upgrade
              </button>
            </div>
          </div>
        )}

        {/* Trial badge — subtle indicator when active */}
        {isTrial && !isReadOnly && !expiryWarning && daysLeft !== null && (
          <div className="mb-5 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}
            >
              <Clock className="w-3 h-3" />
              Trial workspace — {daysLeft} day{daysLeft === 1 ? '' : 's'} remaining
            </span>
          </div>
        )}

        {/* Inbox submission banner */}
        {inboxSubmissionId && !briefSaved && (
          <div
            className="mb-5 flex items-start gap-3 px-4 py-4 rounded-2xl"
            style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)' }}
          >
            <Inbox className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">Inbox submission loaded</p>
              <p className="text-xs text-slate-500 mt-0.5">The decision has been added to the chat. After the War Room runs, save a brief to share back.</p>
            </div>
          </div>
        )}
        {briefSaved && (
          <div
            className="mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">Brief saved — opening for review.</p>
          </div>
        )}

        {/* Main tab switcher */}
        <div className="flex items-center gap-1 bg-white rounded-2xl p-1 mb-6" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
          <button
            onClick={() => setMainTab('chat')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={mainTab === 'chat' ? {
              background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff',
            } : { color: '#64748b' }}
          >
            <MessageSquare className="w-4 h-4" />
            AI Collaboration
          </button>
          <button
            onClick={() => setMainTab('entities')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all relative"
            style={mainTab === 'entities' ? {
              background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff',
            } : { color: '#64748b' }}
          >
            <Zap className="w-4 h-4" />
            War Room
            {!workspaceIsPro && (
              <span
                className="absolute -top-1 -right-1 text-xs font-black px-1.5 py-0.5 rounded-full"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontSize: '9px' }}
              >
                PRO
              </span>
            )}
          </button>
        </div>

        {mainTab === 'chat' && (
          <div className="relative">
            {isReadOnly && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
                style={{ background: 'rgba(248,250,252,0.88)', backdropFilter: 'blur(4px)', pointerEvents: 'none' }}
              >
                <div className="text-center px-6" style={{ pointerEvents: 'auto' }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <Lock className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 mb-1">Chat is read-only</p>
                  <p className="text-xs text-slate-500 mb-4">Upgrade to resume conversations with AI agents.</p>
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Upgrade to unlock
                  </button>
                </div>
              </div>
            )}
            {showResynthesisNudge && !isReadOnly && (
              <div
                className="mb-4 rounded-2xl p-4 flex items-center gap-3 justify-between"
                style={{ background: 'linear-gradient(135deg,rgba(30,58,95,0.06),rgba(37,99,235,0.08))', border: '1px solid rgba(37,99,235,0.2)' }}
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">Agents have responded</p>
                  <p className="text-xs text-slate-500 mt-0.5">Re-synthesize the War Room to update intelligence with these new insights.</p>
                </div>
                <button
                  onClick={handleResynthesis}
                  disabled={resyncing}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
                >
                  {resyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {resyncing ? 'Synthesizing…' : 'Re-synthesize'}
                </button>
              </div>
            )}
            <div
              className="rounded-2xl p-4 sm:p-5"
              style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
            >
              <WorkspaceChat
                workspaceId={workspaceId}
                workspaceName={workspace?.name || 'Workspace'}
                workspaceTopic={workspace?.description}
                initialPrompt={pendingPrompt}
                onPromptConsumed={() => setPendingPrompt(undefined)}
                onAgentsReplied={handleAgentsReplied}
              />
            </div>
          </div>
        )}

        {mainTab === 'entities' && (
          <div>
            {showUpgrade && (
              <UpgradePrompt
                context={isReadOnly ? 'trial_exhausted' : 'workspace'}
                onClose={() => setShowUpgrade(false)}
                onUpgrade={() => { setShowUpgrade(false); onNavigate('pricing'); }}
              />
            )}
            {/* Save as brief — shown when opened from inbox queue */}
            {inboxSubmissionId && workspaceIsPro && !briefSaved && (
              <div
                className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)' }}
              >
                <Inbox className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <p className="text-sm text-slate-700 flex-1">Ready to save this analysis as a shareable brief?</p>
                <button
                  onClick={async () => {
                    const { data } = await supabase
                      .from('workspace_synthesis')
                      .select('*')
                      .eq('workspace_id', workspaceId)
                      .order('generated_at', { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    if (data) await saveBriefFromSynthesis(data as Record<string, unknown>);
                  }}
                  disabled={savingBrief}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: '#2563eb' }}
                >
                  {savingBrief ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {savingBrief ? 'Saving…' : 'Save brief'}
                </button>
              </div>
            )}
            {workspaceIsPro ? (
              <WorkspaceWarRoom
                key={warRoomKey}
                workspaceId={workspaceId}
                workspaceName={workspace?.name || 'Workspace'}
                workspaceTopic={workspace?.description}
                onDiscuss={handleDiscuss}
                discussedKeys={discussedKeys}
                onDiscussed={key => setDiscussedKeys(prev => new Set([...prev, key]))}
              />
            ) : (
              <WarRoomLockedState onUpgrade={() => setShowUpgrade(true)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
