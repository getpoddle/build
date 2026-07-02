import { useState, useEffect, useCallback } from 'react';
import {
  Lock, Settings, ArrowLeft,
  MessageSquare, Zap, RefreshCw, Loader2, AlertTriangle, Sparkles, Clock, ChevronDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useWorkspaceAccess } from '../hooks/useWorkspaceAccess';
import WorkspaceChat from '../components/WorkspaceChat';
import WorkspaceWarRoom, { WarRoomLockedState } from '../components/WorkspaceWarRoom';
import UpgradePrompt from '../components/UpgradePrompt';

type MainTab = 'chat' | 'warroom';

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
  const workspaceIsPro = (plan === 'pro' || plan === 'enterprise') &&
    (subscriptionStatus === 'active' || subscriptionStatus === 'trialing');

  const daysLeft = trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const isTrial = subscriptionStatus === 'trialing';
  const expiryWarning = daysLeft !== null && daysLeft <= 7 && !isReadOnly;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>('chat');
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>(undefined);
  const [resyncing, setResyncing] = useState(false);
  const [warRoomKey, setWarRoomKey] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [discussedKeys, setDiscussedKeys] = useState<Set<string>>(new Set());

  function handleDiscuss(prompt: string) {
    setPendingPrompt(prompt);
    setMainTab('chat');
  }

  async function handleResynthesis() {
    setResyncing(true);
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
        return;
      } finally {
        clearTimeout(timeout);
      }

      let json: { error?: string } = {};
      try { json = await res!.json(); } catch { /* non-critical */ }

      if (!json.error) {
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
    }
  }, [accessLoading, canAccess, fetchWorkspace]);

  /* ── Loading & access-denied states ── */
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
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(15,23,42,0.05)' }}>
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

  /* ── Read-only overlay helper ── */
  function ReadOnlyOverlay() {
    return (
      <div
        className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
        style={{ background: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(4px)' }}
      >
        <div className="text-center px-6">
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
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: 'calc(100dvh - 3.5rem - env(safe-area-inset-top, 0px))',
        background: '#f1f5f9',
      }}
    >

      {/* ── Top header bar ── */}
      <div className="flex-shrink-0 bg-white" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>

        {/* Main header row */}
        <div className="flex items-center gap-3 px-4 lg:px-5 py-3">
          <button
            onClick={onBack}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            <Zap className="w-4 h-4 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black text-slate-900 truncate">{workspace?.name || 'Private Workspace'}</h1>
              {workspaceIsPro && (
                <span
                  className="flex-shrink-0 text-xs font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff', fontSize: '9px' }}
                >
                  {plan === 'enterprise' ? 'ENTERPRISE' : 'PRO'}
                </span>
              )}
              {isTrial && !isReadOnly && daysLeft !== null && (
                <span
                  className="flex-shrink-0 hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}
                >
                  <Clock className="w-3 h-3" />
                  {daysLeft}d trial
                </span>
              )}
            </div>
            {workspace?.description && (
              <p className="text-xs text-slate-400 truncate hidden sm:block mt-0.5">{workspace.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Re-synthesize — desktop primary action in header */}
            {workspaceIsPro && !isReadOnly && (
              <button
                onClick={handleResynthesis}
                disabled={resyncing}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff', boxShadow: '0 2px 8px rgba(37,99,235,0.2)' }}
              >
                {resyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {resyncing ? 'Synthesizing…' : 'Synthesize'}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={onSettings}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Trial / read-only banners */}
        {expiryWarning && (
          <div className="px-4 lg:px-5 py-2 flex items-center gap-3" style={{ background: 'rgba(245,158,11,0.07)', borderTop: '1px solid rgba(245,158,11,0.15)' }}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#b45309' }} />
            <p className="text-xs flex-1" style={{ color: '#92400e' }}>
              <span className="font-bold">Trial expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}.</span>
              {' '}Upgrade to keep this workspace active.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="text-xs font-bold px-2.5 py-1 rounded-lg text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#b45309,#d97706)' }}
            >
              Upgrade
            </button>
          </div>
        )}
        {isReadOnly && (
          <div className="px-4 lg:px-5 py-2 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.05)', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
            <p className="text-xs flex-1 text-red-700">
              <span className="font-bold">Trial expired — read-only.</span>
              {' '}Your data is safe. Upgrade to restore full access.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="text-xs font-bold px-2.5 py-1 rounded-lg text-white flex-shrink-0 flex items-center gap-1"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
            >
              <Sparkles className="w-3 h-3" />
              Upgrade
            </button>
          </div>
        )}

        {/* ── Mobile tab bar ── */}
        <div className="lg:hidden flex" style={{ borderTop: '1px solid rgba(15,23,42,0.07)' }}>
          <button
            onClick={() => setMainTab('chat')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-colors"
            style={mainTab === 'chat'
              ? { color: '#2563eb', borderBottom: '2px solid #2563eb' }
              : { color: '#94a3b8', borderBottom: '2px solid transparent' }}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            AI Collaboration
          </button>
          <button
            onClick={() => setMainTab('warroom')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-colors relative"
            style={mainTab === 'warroom'
              ? { color: '#d97706', borderBottom: '2px solid #d97706' }
              : { color: '#94a3b8', borderBottom: '2px solid transparent' }}
          >
            <Zap className="w-3.5 h-3.5" />
            War Room
            {!workspaceIsPro && (
              <span
                className="absolute top-1.5 right-4 text-white font-black rounded-full"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', fontSize: '8px', padding: '1px 4px' }}
              >
                PRO
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

        {/* ── MOBILE: Chat tab ── */}
        {mainTab === 'chat' && (
          <div className="lg:hidden flex-1 overflow-hidden p-3 sm:p-4">
            <div className="h-full rounded-2xl overflow-hidden relative bg-white" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.08)' }}>
              {isReadOnly && <ReadOnlyOverlay />}
              <div className="h-full p-4">
                <WorkspaceChat
                  workspaceId={workspaceId}
                  workspaceName={workspace?.name || 'Workspace'}
                  workspaceTopic={workspace?.description}
                  initialPrompt={pendingPrompt}
                  onPromptConsumed={() => setPendingPrompt(undefined)}
                  onAgentsReplied={() => {}}
                  isPro={workspaceIsPro}
                  onUpgrade={() => setShowUpgrade(true)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── MOBILE: War Room tab ── */}
        {mainTab === 'warroom' && (
          <div className="lg:hidden flex-1 overflow-y-auto">
            {workspaceIsPro ? (
              <WorkspaceWarRoom
                key={warRoomKey}
                workspaceId={workspaceId}
                workspaceName={workspace?.name || 'Workspace'}
                workspaceTopic={workspace?.description}
                onDiscuss={p => { handleDiscuss(p); setMainTab('chat'); }}
                discussedKeys={discussedKeys}
                onDiscussed={key => setDiscussedKeys(prev => new Set([...prev, key]))}
              />
            ) : (
              <div className="p-4">
                <WarRoomLockedState onUpgrade={() => setShowUpgrade(true)} />
              </div>
            )}
          </div>
        )}

        {/* ── DESKTOP: Side-by-side panels ── */}
        <div className="hidden lg:flex flex-1 overflow-hidden">

          {/* Left: AI Collaboration */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ borderRight: '1px solid rgba(15,23,42,0.08)' }}>
            {/* Panel sub-header */}
            <div
              className="flex-shrink-0 flex items-center gap-2.5 px-5 py-2.5"
              style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(37,99,235,0.02)' }}
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.10)' }}>
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-slate-700">AI Collaboration</span>
              <span className="text-xs text-slate-400 ml-1">— 7 specialist advisors</span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-xs text-slate-400">Live</span>
              </div>
            </div>

            {/* Chat content */}
            <div className="flex-1 min-h-0 relative bg-white">
              {isReadOnly && <ReadOnlyOverlay />}
              <div className="h-full p-5">
                <WorkspaceChat
                  workspaceId={workspaceId}
                  workspaceName={workspace?.name || 'Workspace'}
                  workspaceTopic={workspace?.description}
                  initialPrompt={pendingPrompt}
                  onPromptConsumed={() => setPendingPrompt(undefined)}
                  onAgentsReplied={() => {}}
                  isPro={workspaceIsPro}
                  onUpgrade={() => setShowUpgrade(true)}
                />
              </div>
            </div>
          </div>

          {/* Right: War Room */}
          <div
            className="flex-shrink-0 flex flex-col overflow-hidden"
            style={{ width: 'clamp(440px, 38vw, 640px)' }}
          >
            {/* Panel sub-header */}
            <div
              className="flex-shrink-0 flex items-center gap-2.5 px-5 py-2.5"
              style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(245,158,11,0.02)' }}
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <span className="text-xs font-bold text-slate-700">War Room</span>
              {!workspaceIsPro && (
                <span className="text-xs font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', fontSize: '9px' }}>PRO</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {workspaceIsPro && !isReadOnly && (
                  <button
                    onClick={handleResynthesis}
                    disabled={resyncing}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff', boxShadow: '0 1px 6px rgba(37,99,235,0.2)' }}
                  >
                    {resyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {resyncing ? 'Synthesizing…' : 'Synthesize'}
                  </button>
                )}
              </div>
            </div>

            {/* War Room content — owns the scroll */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#f8fafc' }}>
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
                <div className="p-5">
                  <WarRoomLockedState onUpgrade={() => setShowUpgrade(true)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showUpgrade && (
        <UpgradePrompt
          context={isReadOnly ? 'trial_exhausted' : 'workspace'}
          onClose={() => setShowUpgrade(false)}
          onUpgrade={() => { setShowUpgrade(false); onNavigate('pricing'); }}
        />
      )}
    </div>
  );
}
