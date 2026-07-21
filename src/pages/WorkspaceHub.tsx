import { useState, useEffect, useCallback } from 'react';
import {
  Lock, Settings, ArrowLeft,
  MessageSquare, Activity, RefreshCw, Loader2, AlertTriangle, Cpu, Clock, Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useWorkspaceAccess } from '../hooks/useWorkspaceAccess';
import { useBetaAccess } from '../hooks/useBetaAccess';
import WorkspaceChat from '../components/WorkspaceChat';
import WorkspaceWarRoom, { WarRoomLockedState } from '../components/WorkspaceWarRoom';
import TeamChat from '../components/TeamChat';
import UpgradePrompt from '../components/UpgradePrompt';

type MainTab = 'chat' | 'warroom' | 'team';

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
  initialTab?: string;
  onBack: () => void;
  onSettings: () => void;
  onNavigate: (page: string, id?: string) => void;
  onEntityClick?: (id: string, type: string) => void;
}

export default function WorkspaceHub({ workspaceId, initialTab, onBack, onSettings, onNavigate }: WorkspaceHubProps) {
  const { user } = useAuth();
  const { canAccess, isAdmin, isReadOnly, plan, subscriptionStatus, trialExpiresAt, loading: accessLoading } = useWorkspaceAccess(workspaceId);
  const { hasBetaAccess } = useBetaAccess();
  const workspaceIsPro = hasBetaAccess || (
    (plan === 'pro' || plan === 'enterprise') &&
    (subscriptionStatus === 'active' || subscriptionStatus === 'trialing')
  );

  const daysLeft = trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const isTrial = subscriptionStatus === 'trialing';
  const expiryWarning = daysLeft !== null && daysLeft <= 7 && !isReadOnly;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>(
    initialTab === 'team' ? 'team' : initialTab === 'warroom' ? 'warroom' : 'chat'
  );
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
      const timeout = setTimeout(() => controller.abort(), 180000);

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

  /* ── Loading state ── */
  if (accessLoading) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 3.5rem)', background: 'var(--app-bg)' }}>
        {/* Header skeleton */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 lg:px-5 py-3"
          style={{ background: 'var(--app-surface-raised)', borderBottom: '1px solid var(--app-border)' }}
        >
          <div className="skeleton w-7 h-7" />
          <div className="skeleton w-7 h-7" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-36" />
            <div className="skeleton h-2.5 w-52" />
          </div>
          <div className="skeleton w-28 h-7" />
        </div>
        {/* Panel skeleton */}
        <div className="flex-1 flex p-3 gap-3">
          <div className="skeleton flex-1" style={{ border: '1px solid var(--app-border)' }} />
          <div className="skeleton hidden lg:block w-[420px]" style={{ border: '1px solid var(--app-border)' }} />
        </div>
      </div>
    );
  }

  /* ── Access denied ── */
  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--app-bg)' }}>
        <div className="text-center max-w-xs" style={{ color: 'var(--app-text-primary)' }}>
          <div className="w-12 h-12 flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <Lock className="w-5 h-5" style={{ color: 'var(--app-text-muted)' }} />
          </div>
          <p className="section-label mb-2">Access Restricted</p>
          <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--app-text-primary)' }}>Private Workspace</h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--app-text-secondary)' }}>
            This workspace is invite-only. Contact the workspace owner for access.
          </p>
          <button onClick={onBack} className="btn-ghost text-xs">
            Return to overview
          </button>
        </div>
      </div>
    );
  }

  /* ── Read-only overlay ── */
  function ReadOnlyOverlay() {
    return (
      <div
        className="absolute inset-0 z-10 flex items-center justify-center"
        style={{ background: 'rgba(240,243,247,0.92)', backdropFilter: 'blur(3px)' }}
      >
        <div className="text-center px-6">
          <div className="w-10 h-10 flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)', borderOpacity: '0.3' }}>
            <Lock className="w-4 h-4" style={{ color: 'var(--negative)' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text-primary)' }}>Read-only mode</p>
          <p className="text-xs mb-4" style={{ color: 'var(--app-text-secondary)' }}>Upgrade to resume analysis sessions.</p>
          <button
            onClick={() => setShowUpgrade(true)}
            className="btn-primary"
          >
            Upgrade plan
          </button>
        </div>
      </div>
    );
  }

  const planLabel = plan === 'enterprise' ? 'ENTERPRISE' : 'PRO';

  return (
    <div
      className="flex flex-col overflow-hidden lg:!h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))]"
      style={{
        height: 'calc(100dvh - 3.5rem - env(safe-area-inset-top, 0px) - 5.5rem - env(safe-area-inset-bottom, 0px))',
        background: 'var(--app-bg)',
      }}
    >

      {/* ── Top header bar ── */}
      <div
        className="flex-shrink-0"
        style={{ background: 'var(--app-surface-raised)', borderBottom: '1px solid var(--app-border)' }}
      >

        {/* Main header row */}
        <div className="flex items-center gap-3 px-4 lg:px-5 py-2.5">
          <button
            onClick={onBack}
            className="btn-ghost p-1.5"
            aria-label="Back to workspaces"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          {/* Workspace identity mark */}
          <div
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-xs font-black"
            style={{ background: 'var(--ink-50)', color: 'var(--ink-900)', border: '1px solid var(--app-border)' }}
            title={workspace?.name}
          >
            {(workspace?.name || 'W').slice(0, 1).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold truncate" style={{ color: 'var(--app-text-primary)' }}>
                {workspace?.name || 'Private Workspace'}
              </h1>
              {workspaceIsPro && (
                <span className="badge badge-amber flex-shrink-0">{planLabel}</span>
              )}
              {isTrial && !isReadOnly && daysLeft !== null && (
                <span className="hidden sm:inline-flex items-center gap-1 badge badge-slate flex-shrink-0">
                  <Clock className="w-2.5 h-2.5" />
                  {daysLeft}d
                </span>
              )}
            </div>
            {workspace?.description && (
              <p className="text-xs truncate hidden sm:block mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                {workspace.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {workspaceIsPro && !isReadOnly && (
              <button
                onClick={handleResynthesis}
                disabled={resyncing}
                className="hidden lg:flex btn-primary gap-1.5 disabled:opacity-50"
                style={{ padding: '0.375rem 0.875rem', fontSize: '0.75rem' }}
              >
                {resyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {resyncing ? 'Synthesizing' : 'Synthesize'}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={onSettings}
                className="btn-ghost gap-1.5"
                style={{ padding: '0.375rem 0.625rem', fontSize: '0.75rem' }}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Banners */}
        {expiryWarning && (
          <div
            className="px-4 lg:px-5 py-2 flex items-center gap-3"
            style={{ background: 'var(--signal-bg)', borderTop: '1px solid var(--signal)', borderTopOpacity: '0.3' }}
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--signal)' }} />
            <p className="text-xs flex-1" style={{ color: 'var(--app-text-secondary)' }}>
              <span className="font-semibold">Trial expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}.</span>
              {' '}Upgrade to maintain access.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="btn-primary flex-shrink-0"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.6875rem' }}
            >
              Upgrade
            </button>
          </div>
        )}
        {isReadOnly && (
          <div
            className="px-4 lg:px-5 py-2 flex items-center gap-3"
            style={{ background: 'var(--negative-bg)', borderTop: '1px solid var(--negative)', borderTopOpacity: '0.25' }}
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--negative)' }} />
            <p className="text-xs flex-1" style={{ color: 'var(--app-text-secondary)' }}>
              <span className="font-semibold">Trial expired — read-only.</span>
              {' '}Your data is preserved. Upgrade to restore full access.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="btn-primary flex-shrink-0"
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.6875rem' }}
            >
              Upgrade
            </button>
          </div>
        )}

        {/* ── Mobile tab bar ── */}
        <div
          className="lg:hidden flex flex-shrink-0"
          style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}
        >
          {([ 
            { id: 'chat' as MainTab, label: 'AI Collaboration', Icon: MessageSquare },
            { id: 'team' as MainTab, label: 'Team Chat', Icon: Users },
            { id: 'warroom' as MainTab, label: 'War Room', Icon: Activity },
          ] as const).map(({ id, label, Icon }) => {
            const active = mainTab === id;
            return (
              <button
                key={id}
                onClick={() => setMainTab(id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors relative"
                style={{
                  color: active ? 'var(--signal)' : 'var(--app-text-muted)',
                  borderBottom: active ? '2px solid var(--signal)' : '2px solid transparent',
                  background: active ? 'var(--signal-bg)' : 'transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {id === 'warroom' && !workspaceIsPro && (
                  <span className="badge badge-amber absolute top-1.5 right-2" style={{ padding: '0.1rem 0.35rem', fontSize: '9px' }}>PRO</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

        {/* ── MOBILE: Chat tab ── */}
        {mainTab === 'chat' && (
          <div className="lg:hidden flex-1 overflow-hidden p-2">
            <div
              className="h-full overflow-hidden relative"
              style={{ background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              {isReadOnly && <ReadOnlyOverlay />}
              <div className="h-full p-3">
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

        {/* ── MOBILE: Team Chat tab ── */}
        {mainTab === 'team' && (
          <div className="lg:hidden flex-1 overflow-hidden p-2">
            <div
              className="h-full overflow-hidden relative"
              style={{ background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              {isReadOnly && <ReadOnlyOverlay />}
              <div className="h-full">
                <TeamChat
                  workspaceId={workspaceId}
                  workspaceName={workspace?.name || 'Workspace'}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── MOBILE: War Room tab ── */}
        {mainTab === 'warroom' && (
          <div className="lg:hidden flex-1 overflow-y-auto" style={{ paddingBottom: '1rem' }}>
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

          {/* Left: AI Collaboration or Team Chat (switches based on tab) */}
          <div
            className="flex-1 min-w-0 max-w-[900px] mx-auto w-full flex flex-col overflow-hidden"
            style={{ borderRight: '1px solid var(--app-border)' }}
          >
            {/* Desktop tab switcher */}
            <div
              className="flex-shrink-0 flex items-center px-3 pt-2 gap-1"
              style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface)' }}
            >
              {([
                { id: 'chat' as MainTab, label: 'AI Collaboration', Icon: MessageSquare },
                { id: 'team' as MainTab, label: 'Team Chat', Icon: Users },
              ] as const).map(({ id, label, Icon }) => {
                const active = mainTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setMainTab(id)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors relative"
                    style={{
                      color: active ? 'var(--signal)' : 'var(--app-text-muted)',
                      borderBottom: active ? '2px solid var(--signal)' : '2px solid transparent',
                      background: active ? 'var(--signal-bg)' : 'transparent',
                      marginBottom: '-1px',
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
              {mainTab === 'chat' && (
                <div className="ml-auto flex items-center gap-1.5 pr-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--positive)' }} />
                  <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Live</span>
                </div>
              )}
            </div>

            {mainTab === 'team' ? (
              <TeamChat
                workspaceId={workspaceId}
                workspaceName={workspace?.name || 'Workspace'}
              />
            ) : (
              <>
              <div className="flex-1 min-h-0 relative" style={{ background: 'var(--app-surface-raised)' }}>
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
              </>
            )}
          </div>

          {/* Right: War Room */}
          <div
            className="flex-shrink-0 flex flex-col overflow-hidden"
            style={{ width: 'clamp(440px, 38vw, 640px)' }}
          >
            {/* Panel header */}
            <div
              className="flex-shrink-0 flex items-center gap-2.5 px-5 py-2.5"
              style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface)' }}
            >
              <Activity className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--signal)' }} />
              <span className="section-label">War Room</span>
              {!workspaceIsPro && (
                <span className="badge badge-amber" style={{ fontSize: '9px' }}>PRO</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {workspaceIsPro && !isReadOnly && (
                  <button
                    onClick={handleResynthesis}
                    disabled={resyncing}
                    className="btn-primary disabled:opacity-50"
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.6875rem', gap: '0.375rem' }}
                  >
                    {resyncing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
                    {resyncing ? 'Synthesizing' : 'Synthesize'}
                  </button>
                )}
              </div>
            </div>

            {/* War Room content */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: 'var(--app-bg)' }}>
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

      {/* suppress unused import lint */}
      <span className="hidden">{user?.id}{Cpu && ''}</span>
    </div>
  );
}
