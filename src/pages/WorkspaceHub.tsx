import { useState, useEffect, useCallback } from 'react';
import {
  Lock, Settings, ArrowLeft,
  MessageSquare, Zap, RefreshCw, Loader2, AlertTriangle, Sparkles, Clock
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
  const workspaceIsPro = (plan === 'pro' || plan === 'enterprise') &&
    (subscriptionStatus === 'active' || subscriptionStatus === 'trialing');

  const daysLeft = trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const isTrial = subscriptionStatus === 'trialing';
  const expiryWarning = daysLeft !== null && daysLeft <= 7 && !isReadOnly;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  // On mobile we use a tab switcher; on desktop both panels render side-by-side
  const [mainTab, setMainTab] = useState<MainTab>('chat');
  const [pendingPrompt, setPendingPrompt] = useState<string | undefined>(undefined);
  const [showResynthesisNudge, setShowResynthesisNudge] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [warRoomKey, setWarRoomKey] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [discussedKeys, setDiscussedKeys] = useState<Set<string>>(new Set());

  function handleDiscuss(prompt: string) {
    setPendingPrompt(prompt);
    setShowResynthesisNudge(false);
    setMainTab('chat');
  }

  function handleAgentsReplied() {
    // noop
  }

  async function handleResynthesis() {
    setResyncing(true);
    setShowResynthesisNudge(false);
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
        return;
      } finally {
        clearTimeout(timeout);
      }

      let json: { error?: string } = {};
      try { json = await res.json(); } catch { /* non-critical */ }

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
      <div className="px-4 lg:px-6 py-6 lg:py-8">

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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={onSettings}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 border hover:bg-white transition-all"
                style={{ borderColor: 'rgba(15,23,42,0.1)' }}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}
          </div>
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

        {/* Trial badge */}
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

        {/* Re-synthesis nudge */}
        {showResynthesisNudge && !isReadOnly && (
          <div
            className="mb-5 rounded-2xl p-4 flex items-center gap-3 justify-between"
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

        {/* Mobile tab switcher */}
        <div className="lg:hidden flex items-center gap-1 bg-white rounded-2xl p-1 mb-5" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
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

        {/* Mobile: single panel */}
        <div className="lg:hidden">
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
              <div
                className="rounded-2xl p-4"
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

        {/* Desktop: side-by-side layout */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_480px] 2xl:grid-cols-[1fr_560px] gap-6">
          {/* Left: Chat panel */}
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-700">AI Collaboration</h2>
            </div>
            {isReadOnly && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
                style={{ background: 'rgba(248,250,252,0.88)', backdropFilter: 'blur(4px)', pointerEvents: 'none', top: '2rem' }}
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
            <div
              className="rounded-2xl p-5"
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

          {/* Right: War Room panel */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-700">War Room</h2>
                {!workspaceIsPro && (
                  <span
                    className="text-xs font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontSize: '9px' }}
                  >
                    PRO
                  </span>
                )}
              </div>
              {workspaceIsPro && !isReadOnly && (
                <button
                  onClick={handleResynthesis}
                  disabled={resyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', color: '#fff', boxShadow: '0 2px 8px rgba(37,99,235,0.2)' }}
                >
                  {resyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {resyncing ? 'Synthesizing…' : 'Re-synthesize'}
                </button>
              )}
            </div>
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
        </div>

        {/* Upgrade prompt (mobile War Room tab) */}
        {showUpgrade && (
          <UpgradePrompt
            context={isReadOnly ? 'trial_exhausted' : 'workspace'}
            onClose={() => setShowUpgrade(false)}
            onUpgrade={() => { setShowUpgrade(false); onNavigate('pricing'); }}
          />
        )}
      </div>
    </div>
  );
}
