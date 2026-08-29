import { useState } from 'react';
import { Lock, Plus, Settings, Users, ArrowRight, Crown, Shield, User, Sparkles, Brain, Clock, AlertTriangle, ChevronRight, Zap, MessageSquare, ExternalLink, LayoutList, Map, Bot, TrendingUp } from 'lucide-react';
import { useUserWorkspaces, useSubscriptionTier, useTrialInfo } from '../hooks/useWorkspaceAccess';
import { useAuth } from '../contexts/AuthContext';
import { useBetaAccess } from '../hooks/useBetaAccess';
import CreateWorkspace from '../components/CreateWorkspace';
import UpgradePrompt from '../components/UpgradePrompt';
import CrossWorkspacePatternCard from '../components/CrossWorkspacePatternCard';

interface WorkspacesProps {
  onNavigate: (page: string, workspaceId?: string) => void;
}

const ROLE_ICONS = { owner: Crown, admin: Shield, member: User };

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function Workspaces({ onNavigate }: WorkspacesProps) {
  const { user } = useAuth();
  const { workspaces, loading, refetch } = useUserWorkspaces();
  const { isPro } = useSubscriptionTier();
  const { trialExhausted, trialLimitReached, monthlyLimitReached, trialCount, trialSlotsRemaining, trialLimit, loading: trialLoading } = useTrialInfo();
  const { hasBetaAccess } = useBetaAccess();
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  function handleCreateClick() {
    if (!isPro && !hasBetaAccess && trialExhausted) {
      setShowUpgrade(true);
    } else {
      setShowCreate(true);
    }
  }

  function handleCreated(workspaceId: string) {
    setShowCreate(false);
    refetch();
    onNavigate('workspace-hub', workspaceId);
  }

  const isLoading = loading || trialLoading;

  const appWorkspaces = workspaces.filter(w => w.source !== 'slack');
  const slackWorkspaces = workspaces.filter(w => w.source === 'slack')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const activeCount = appWorkspaces.filter(w => w.subscription_status === 'active' || w.subscription_status === 'trialing').length;
  const totalSeats = appWorkspaces.reduce((sum, w) => sum + (w.seats || 0), 0);
  const ownerCount = appWorkspaces.filter(w => w.role === 'owner').length;

  const STATS = [
    { label: 'Workspaces', value: String(appWorkspaces.length || 0), sub: `${activeCount} active`, icon: Lock },
    { label: 'Total seats', value: String(totalSeats), sub: 'Across all plans', icon: Users },
    { label: 'You own', value: String(ownerCount), sub: 'Owner role', icon: Crown },
    { label: 'Slack sessions', value: String(slackWorkspaces.length), sub: 'From /poddle', icon: MessageSquare },
  ];

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div
        className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 mx-auto"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* Page header */}
        <div className="mb-6 lg:mb-10">
          <p className="section-label mb-2">Private Spaces</p>
          <h1 className="display-heading text-xl lg:text-2xl xl:text-3xl">Private Workspaces</h1>
          <p className="text-sm lg:text-base mt-1" style={{ color: 'var(--app-text-secondary)' }}>Encrypted spaces where your team debates proprietary decisions with AI agents.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-10">
          {STATS.map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <div className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center" style={{ background: 'var(--signal-bg)' }}>
                  <Icon className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                </div>
              </div>
              <p className="stat-card-value">{value}</p>
              <p className="stat-card-label">{label}</p>
              <p className="text-[11px] lg:text-xs mt-0.5 hidden sm:block" style={{ color: 'var(--app-text-muted)' }}>{sub}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4 lg:space-y-6">
          {/* Main content */}
          <div className="min-w-0 space-y-4 lg:space-y-6">

            {/* Hero banner */}
            <div
              className="relative overflow-hidden p-6 lg:p-10"
              style={{
                background: '#0e1117',
                border: '1px solid var(--app-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(184,134,11,0.08) 0%,transparent 70%)' }} />
              <div className="absolute -bottom-8 -left-8 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(184,134,11,0.05) 0%,transparent 70%)' }} />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex-1">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 mb-4"
                    style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}
                  >
                    <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--signal)' }} />
                    <span className="mono-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--signal)' }}>Encrypted Team Spaces</span>
                  </div>
                  <h2 className="display-heading text-lg lg:text-2xl xl:text-3xl mb-3" style={{ color: '#e8ecf2' }}>
                    Where your team's hardest decisions get debated.
                  </h2>
                  <p className="text-sm lg:text-base leading-relaxed max-w-lg" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    Spin up a private workspace, invite your team, and let AI agents stress-test your decisions — risks, financials, strategy, bias, consensus, recommendations, action items in one place.
                  </p>
                </div>

                <div className="flex flex-row sm:flex-col gap-3 sm:flex-shrink-0">
                  <button onClick={handleCreateClick} className="btn-primary flex-1 sm:flex-none">
                    {!isPro && !hasBetaAccess && trialExhausted ? <Sparkles className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {!isPro && !hasBetaAccess && trialExhausted ? 'Upgrade' : 'New Workspace'}
                  </button>
                  <button
                    onClick={() => onNavigate('pricing')}
                    className="btn-secondary flex-1 sm:flex-none"
                    style={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.4)', background: 'transparent' }}
                  >
                    View Pricing
                  </button>
                </div>
              </div>
            </div>

            {/* Monthly workspace status banner */}
            {!isLoading && !isPro && !hasBetaAccess && monthlyLimitReached && (
              <div
                className="flex items-center gap-3 px-5 py-3.5"
                style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}
              >
                <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--signal)' }} />
                <p className="text-sm flex-1" style={{ color: 'var(--app-text-secondary)' }}>
                  <span className="font-semibold text-signal">Free trial active</span>
                  {' '}— {trialSlotsRemaining} of {trialLimit} workspaces remaining. Each trial lasts 7 days.
                </p>
                <button onClick={() => setShowUpgrade(true)} className="btn-primary flex-shrink-0" style={{ padding: '0.25rem 0.75rem', fontSize: '0.6875rem' }}>
                  Upgrade
                </button>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && appWorkspaces.length === 0 && (
              <div className="panel p-8 lg:p-16 text-center">
                <div className="w-16 h-16 flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}>
                  <Lock className="w-8 h-8" style={{ color: 'var(--signal)' }} />
                </div>
                <h2 className="display-heading text-xl mb-2">No private workspaces yet</h2>
                <p className="text-sm max-w-sm mx-auto mb-8 leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
                  3 free workspaces with a 7-day trial each — no credit card needed. Full Pro features including encrypted team spaces and AI War Room.
                </p>
                <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto mb-8">
                  {[
                    { icon: Lock, label: 'End-to-end encrypted' },
                    { icon: Users, label: 'Invite-only access' },
                    { icon: Brain, label: 'AI agent debates' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 flex items-center justify-center" style={{ background: 'var(--signal-bg)' }}>
                        <Icon className="w-5 h-5" style={{ color: 'var(--signal)' }} />
                      </div>
                      <span className="text-xs text-center leading-tight" style={{ color: 'var(--app-text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
                <button onClick={handleCreateClick} className="btn-primary">
                  {trialExhausted ? <><Sparkles className="w-4 h-4" /> Upgrade for Unlimited Workspaces</> : <><Lock className="w-4 h-4" /> Create Your Free Workspace</>}
                </button>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-20" />)}
              </div>
            )}
            

            {/* Workspace list — desktop table-style */}
            {!isLoading && appWorkspaces.length > 0 && view === 'list' && (
              <div className="panel overflow-hidden">
                {/* Table header — hidden on mobile */}
                <div
                  className="hidden xl:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 px-6 py-3 mono-xs uppercase tracking-widest"
                  style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-raised)', color: 'var(--app-text-muted)' }}
                >
                  <span>Workspace</span>
                  <span className="text-center w-20">Plan</span>
                  <span className="text-center w-20">Status</span>
                  <span className="text-center w-24">Role</span>
                  <span className="w-16" />
                </div>

                {appWorkspaces.map((ws, idx) => {
                  const statusLabel = ws.subscription_status === 'active' ? 'Active' : ws.subscription_status === 'trialing' ? 'Trial' : ws.subscription_status === 'cancelled' ? 'Cancelled' : ws.subscription_status === 'past_due' ? 'Past due' : 'Expired';
                  const statusColor = ws.subscription_status === 'active' ? 'var(--positive)' : ws.subscription_status === 'trialing' ? 'var(--signal)' : ws.subscription_status === 'cancelled' || ws.subscription_status === 'inactive' ? 'var(--negative)' : 'var(--caution)';
                  const statusBg = ws.subscription_status === 'active' ? 'var(--positive-bg)' : ws.subscription_status === 'trialing' ? 'var(--signal-bg)' : ws.subscription_status === 'cancelled' || ws.subscription_status === 'inactive' ? 'var(--negative-bg)' : 'rgba(245,158,11,0.08)';
                  const role = ws.role as 'owner' | 'admin' | 'member';
                  const RoleIcon = ROLE_ICONS[role] || User;
                  const roleColor = role === 'owner' ? 'var(--signal)' : role === 'admin' ? 'var(--agent-fin)' : 'var(--app-text-muted)';
                  const isExpired = ws.subscription_status === 'inactive';
                  const isTrial = ws.subscription_status === 'trialing' && !ws.stripe_customer_id;
                  const daysLeft = isTrial ? daysUntil(ws.trial_workspace_expires_at) : null;
                  const expiryWarning = daysLeft !== null && daysLeft <= 7;
                  const isLast = idx === appWorkspaces.length - 1;

                  return (
                    <div
                      key={ws.id}
                      className="group cursor-pointer transition-colors duration-150"
                      style={!isLast ? { borderBottom: '1px solid var(--app-border)' } : undefined}
                      onClick={() => onNavigate('workspace-hub', ws.id)}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--app-border-subtle)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Alert strip */}
                      {(expiryWarning && !isExpired) && (
                        <div
                          className="flex items-center gap-2 px-6 py-2 text-xs font-semibold"
                          style={{ background: 'var(--signal-bg)', borderBottom: '1px solid var(--signal)' }}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--signal)' }} />
                          <span style={{ color: 'var(--caution)' }}>Trial expires in {daysLeft} day{daysLeft === 1 ? '' : 's'} — upgrade to keep this workspace active</span>
                        </div>
                      )}
                      {isExpired && (
                        <div
                          className="flex items-center gap-2 px-6 py-2 text-xs font-semibold"
                          style={{ background: 'var(--negative-bg)', borderBottom: '1px solid var(--negative)' }}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--negative)' }} />
                          <span style={{ color: 'var(--negative)' }}>Expired — this workspace is read-only. Upgrade to restore full access.</span>
                        </div>
                      )}

                      {/* Mobile layout */}
                      <div className="xl:hidden p-5 flex items-center gap-4">
                        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0" style={{ background: isExpired ? 'var(--app-border)' : 'var(--app-surface-raised)', border: '1px solid var(--app-border)' }}>
                          <Lock className="w-5 h-5" style={{ color: isExpired ? 'var(--app-text-muted)' : 'var(--signal)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <h3 className="text-sm font-semibold truncate" style={{ color: isExpired ? 'var(--app-text-muted)' : 'var(--app-text-primary)' }}>{ws.name}</h3>
                            <span className="badge badge-amber capitalize">{ws.plan}</span>
                            <span className="badge" style={{ background: statusBg, color: statusColor, borderColor: statusColor }}>{statusLabel}</span>
                          </div>
                          {ws.description && <p className="text-xs truncate" style={{ color: 'var(--app-text-muted)' }}>{ws.description}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <RoleIcon className="w-3 h-3" style={{ color: roleColor }} />
                              <span className="text-xs capitalize" style={{ color: roleColor }}>{role}</span>
                            </div>
                            <div className="flex items-center gap-1" style={{ color: 'var(--app-text-muted)' }}>
                              <Users className="w-3 h-3" />
                              <span className="text-xs">{ws.seats} seats</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {(role === 'owner' || role === 'admin') && (
                            <button
                              onClick={e => { e.stopPropagation(); onNavigate('workspace-settings', ws.id); }}
                              className="btn-ghost p-2"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
                        </div>
                      </div>

                      {/* Desktop table row */}
                      <div className="hidden xl:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 items-center px-6 py-4">
                        {/* Name + description */}
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: isExpired ? 'var(--app-border)' : 'var(--app-surface-raised)', border: '1px solid var(--app-border)' }}>
                            <Lock className="w-4 h-4" style={{ color: isExpired ? 'var(--app-text-muted)' : 'var(--signal)' }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate" style={{ color: isExpired ? 'var(--app-text-muted)' : 'var(--app-text-primary)' }}>{ws.name}</p>
                              {isTrial && daysLeft !== null && !expiryWarning && (
                                <span className="mono-xs" style={{ color: 'var(--app-text-muted)' }}>{daysLeft}d left</span>
                              )}
                            </div>
                            {ws.description
                              ? <p className="text-xs truncate mt-0.5" style={{ color: 'var(--app-text-muted)' }}>{ws.description}</p>
                              : <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)', opacity: 0.5 }}>No description</p>
                            }
                          </div>
                        </div>

                        {/* Plan */}
                        <div className="w-20 flex justify-center">
                          <span className="badge badge-amber capitalize">{ws.plan}</span>
                        </div>

                        {/* Status */}
                        <div className="w-20 flex justify-center">
                          <span className="badge" style={{ background: statusBg, color: statusColor, borderColor: statusColor }}>{statusLabel}</span>
                        </div>

                        {/* Role */}
                        <div className="w-24 flex justify-center">
                          <div className="flex items-center gap-1.5">
                            <RoleIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: roleColor }} />
                            <span className="text-xs font-medium capitalize" style={{ color: roleColor }}>{role}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="w-16 flex items-center justify-end gap-1">
                          {(role === 'owner' || role === 'admin') && (
                            <button
                              onClick={e => { e.stopPropagation(); onNavigate('workspace-settings', ws.id); }}
                              className="btn-ghost p-2"
                              title="Settings"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className="w-8 h-8 flex items-center justify-center">
                            <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--app-text-muted)' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upgrade banner when trial limit reached */}
            {!isLoading && !isPro && trialLimitReached && appWorkspaces.length > 0 && view === 'list' && (
              <div className="panel p-5 flex items-center gap-4" style={{ background: 'var(--signal-bg)' }}>
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: 'var(--signal)' }}>
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--ink-900)' }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>Upgrade for unlimited workspaces</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>You've used all {trialLimit} trial workspaces. Go Pro for unlimited.</p>
                </div>
                <button onClick={() => setShowUpgrade(true)} className="btn-primary flex-shrink-0">
                  Upgrade
                </button>
              </div>
            )}

            {/* Slack Sessions */}
            {!isLoading && view === 'list' && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: 'var(--app-border-subtle)' }}>
                    <MessageSquare className="w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
                  </div>
                  <div>
                    <p className="section-label">Slack Sessions</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>War Rooms generated from <code className="mono-xs">/poddle</code> commands — each question gets its own isolated workspace.</p>
                  </div>
                </div>

                {slackWorkspaces.length === 0 ? (
                  <div className="panel p-6 flex items-center gap-4" style={{ borderStyle: 'dashed' }}>
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: 'var(--app-border-subtle)' }}>
                      <MessageSquare className="w-5 h-5" style={{ color: 'var(--app-text-muted)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>No Slack sessions yet</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                        Use <code className="mono-xs" style={{ background: 'var(--app-border-subtle)', padding: '0.125rem 0.375rem' }}>/poddle &lt;your question&gt;</code> in Slack to generate a fresh War Room for any decision.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {slackWorkspaces.map(ws => {
                      const daysLeft = daysUntil(ws.trial_workspace_expires_at);
                      const isExpired = ws.subscription_status === 'inactive' || (daysLeft !== null && daysLeft <= 0);
                      return (
                        <div
                          key={ws.id}
                          className="group flex items-center gap-4 px-5 py-4 panel cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
                          style={{ opacity: isExpired ? 0.65 : 1 }}
                          onClick={() => onNavigate('workspace-hub', ws.id)}
                        >
                          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: isExpired ? 'var(--app-border)' : 'var(--app-border-subtle)' }}>
                            <MessageSquare className="w-4 h-4" style={{ color: isExpired ? 'var(--app-text-muted)' : 'var(--app-text-secondary)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: isExpired ? 'var(--app-text-muted)' : 'var(--app-text-primary)' }}>{ws.name}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="mono-xs" style={{ color: 'var(--app-text-muted)' }}>{formatDate(ws.created_at)}</span>
                              {daysLeft !== null && daysLeft > 0 && (
                                <span className="mono-xs" style={{ color: 'var(--app-text-muted)' }}>· expires in {daysLeft}d</span>
                              )}
                              {isExpired && (
                                <span className="mono-xs" style={{ color: 'var(--negative)' }}>· expired</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="hidden sm:inline badge badge-slate">Slack</span>
                            <ExternalLink className="w-3.5 h-3.5" style={{ color: 'var(--app-text-muted)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Cross-workspace Decision Intelligence */}
            {!isLoading && user && view === 'list' && (
              <CrossWorkspacePatternCard userId={user.id} />
            )}

            {/* Feature callout strip */}
            {!isLoading && view === 'list' && (
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: Lock, title: 'End-to-end encrypted', desc: 'All workspace data encrypted at rest and in transit' },
                  { icon: Zap, title: 'AI War Room', desc: 'Synthesize discussions into structured intelligence in under 60s' },
                  { icon: Users, title: 'Team collaboration', desc: 'Invite members and assign roles — owner, admin, or member' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="panel p-4 flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--signal-bg)' }}>
                      <Icon className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--app-text-primary)' }}>{title}</p>
                      <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {showCreate && (
        <CreateWorkspace
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          onNavigatePricing={() => onNavigate('pricing')}
        />
      )}

      {showUpgrade && (
        <UpgradePrompt
          context="trial_exhausted"
          onClose={() => setShowUpgrade(false)}
          onUpgrade={() => { setShowUpgrade(false); onNavigate('pricing'); }}
        />
      )}
    </div>
  );
}
