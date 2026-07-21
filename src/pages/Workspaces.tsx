import { useState } from 'react';
import { Lock, Plus, Settings, Users, ArrowRight, Crown, Shield, User, Sparkles, Brain, Clock, AlertTriangle, ChevronRight, Zap, MessageSquare, ExternalLink, LayoutList, Map, Bot, TrendingUp } from 'lucide-react';
import { useUserWorkspaces, useSubscriptionTier, useTrialInfo } from '../hooks/useWorkspaceAccess';
import { useAuth } from '../contexts/AuthContext';
import { useBetaAccess } from '../hooks/useBetaAccess';
import CreateWorkspace from '../components/CreateWorkspace';
import UpgradePrompt from '../components/UpgradePrompt';
import CrossWorkspacePatternCard from '../components/CrossWorkspacePatternCard';
import DecisionMap from '../components/DecisionMap';
import AskAgentsSidebar from '../components/AskAgentsSidebar';

interface WorkspacesProps {
  onNavigate: (page: string, workspaceId?: string) => void;
}

const PLAN_BADGE_STYLE: Record<string, { background: string; color: string }> = {
  pro: { background: 'rgba(37,99,235,0.08)', color: '#2563eb' },
  enterprise: { background: 'rgba(245,158,11,0.1)', color: '#b45309' },
};

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  active: { background: 'rgba(22,163,74,0.1)', color: '#16a34a' },
  trialing: { background: 'rgba(37,99,235,0.08)', color: '#2563eb' },
  cancelled: { background: 'rgba(239,68,68,0.08)', color: '#dc2626' },
  past_due: { background: 'rgba(245,158,11,0.1)', color: '#b45309' },
  inactive: { background: 'rgba(239,68,68,0.08)', color: '#dc2626' },
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  cancelled: 'Cancelled',
  past_due: 'Past due',
  inactive: 'Expired',
};

const ROLE_ICONS = { owner: Crown, admin: Shield, member: User };
const ROLE_COLORS = { owner: '#f59e0b', admin: '#2563eb', member: '#64748b' };

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function Workspaces({ onNavigate }: WorkspacesProps) {
  const { user } = useAuth();
  const { workspaces, loading, refetch } = useUserWorkspaces();
  const { isPro } = useSubscriptionTier();
  const { trialExhausted, monthlyLimitReached, resetsOn, expiresOn, loading: trialLoading } = useTrialInfo();
  const { hasBetaAccess } = useBetaAccess();
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');

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
    { label: 'Workspaces', value: String(appWorkspaces.length || 0), sub: `${activeCount} active`, icon: Lock, color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
    { label: 'Total seats', value: String(totalSeats), sub: 'Across all plans', icon: Users, color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
    { label: 'You own', value: String(ownerCount), sub: 'Owner role', icon: Crown, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Slack sessions', value: String(slackWorkspaces.length), sub: 'From /poddle', icon: MessageSquare, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  ];

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div
        className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 max-w-[1400px] mx-auto"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* Page header */}
        <div className="mb-6 lg:mb-10">
          <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold text-slate-900 mb-1 tracking-tight">Private Workspaces</h1>
          <p className="text-slate-500 text-sm lg:text-base">Encrypted spaces where your team debates proprietary ideas with AI agents.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-10">
          {STATS.map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-4 lg:p-5"
              style={{ border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
            >
              <div className="flex items-center justify-between mb-3 lg:mb-4">
                <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                  <Icon style={{ width: '1rem', height: '1rem', color }} />
                </div>
              </div>
              <p className="text-xl lg:text-2xl xl:text-3xl font-bold text-slate-900 mb-0.5">{value}</p>
              <p className="text-xs lg:text-sm font-semibold text-slate-600 leading-tight">{label}</p>
              <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5 hidden sm:block">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid xl:grid-cols-[1fr_300px] 2xl:grid-cols-[1fr_340px] gap-5 lg:gap-8">
          {/* Main content */}
          <div className="min-w-0 space-y-4 lg:space-y-6">

            {/* Hero banner */}
            <div
              className="relative overflow-hidden rounded-2xl p-6 lg:p-10"
              style={{
                background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#1e40af 100%)',
                boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
              }}
            >
              <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(6,182,212,0.15) 0%,transparent 70%)' }} />
              <div className="absolute -bottom-8 -left-8 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(37,99,235,0.1) 0%,transparent 70%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex-1">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', color: '#93c5fd' }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Encrypted Team Spaces
                  </div>
                  <h2 className="text-lg lg:text-2xl xl:text-3xl font-bold text-white mb-3 leading-snug">
                    Where your team's hardest decisions get debated.
                  </h2>
                  <p className="text-sm lg:text-base leading-relaxed max-w-lg" style={{ color: 'rgba(203,213,225,0.85)' }}>
                    Spin up a private workspace, invite your team, and let AI agents stress-test your ideas — risks, consensus, and action items in one place.
                  </p>
                </div>

                <div className="flex flex-row sm:flex-col gap-3 sm:flex-shrink-0">
                  <button
                    onClick={handleCreateClick}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap"
                    style={{ background: '#2563eb', color: '#fff', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' }}
                  >
                    {!isPro && !hasBetaAccess && trialExhausted ? <Sparkles className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {!isPro && !hasBetaAccess && trialExhausted ? 'Upgrade' : 'New Workspace'}
                  </button>
                  <button
                    onClick={() => onNavigate('pricing')}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 whitespace-nowrap"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    View Pricing
                  </button>
                </div>
              </div>
            </div>

            {/* View toggle + actions row */}
            {!isLoading && appWorkspaces.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex items-center rounded-xl p-1"
                  style={{ background: 'rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.08)' }}
                >
                  <button
                    onClick={() => setView('list')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                    style={view === 'list'
                      ? { background: '#fff', color: '#1e3a5f', boxShadow: '0 1px 3px rgba(15,23,42,0.12)' }
                      : { color: '#64748b' }}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">List</span>
                  </button>
                  <button
                    onClick={() => setView('map')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                    style={view === 'map'
                      ? { background: '#fff', color: '#1e3a5f', boxShadow: '0 1px 3px rgba(15,23,42,0.12)' }
                      : { color: '#64748b' }}
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Map</span>
                  </button>
                </div>
              </div>
            )}

            {/* Monthly workspace status banner */}
            {!isLoading && !isPro && !hasBetaAccess && monthlyLimitReached && (
              <div
                className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
                style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}
              >
                <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#2563eb' }} />
                <p className="text-sm text-slate-700 flex-1">
                  <span className="font-bold" style={{ color: '#2563eb' }}>Free workspace active this month</span>
                  {' '}— expires {expiresOn}. New slot opens {resetsOn}.
                </p>
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
                >
                  Upgrade
                </button>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && appWorkspaces.length === 0 && (
              <div
                className="rounded-2xl p-8 lg:p-16 text-center"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}
              >
                <div
                  className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
                >
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">No private workspaces yet</h2>
                <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
                  1 free workspace every month — no credit card needed. Full Pro features until the end of the month, including encrypted team spaces and AI War Room.
                </p>
                <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto mb-8">
                  {[
                    { icon: Lock, label: 'End-to-end encrypted' },
                    { icon: Users, label: 'Invite-only access' },
                    { icon: Brain, label: 'AI agent debates' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-2">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(37,99,235,0.08)' }}
                      >
                        <Icon className="w-5 h-5" style={{ color: '#2563eb' }} />
                      </div>
                      <span className="text-xs text-slate-500 text-center leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleCreateClick}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 8px 24px rgba(37,99,235,0.3)' }}
                >
                  {trialExhausted ? (
                    <><Sparkles className="w-4 h-4" /> Upgrade for Unlimited Workspaces</>
                  ) : (
                    <><Lock className="w-4 h-4" /> Create Your Free Workspace</>
                  )}
                </button>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(15,23,42,0.05)' }} />
                ))}
              </div>
            )}

            {/* Decision Map view */}
            {!isLoading && appWorkspaces.length > 0 && view === 'map' && (
              <DecisionMap workspaces={appWorkspaces} onNavigate={onNavigate} />
            )}

            {/* Workspace list — desktop table-style */}
            {!isLoading && appWorkspaces.length > 0 && view === 'list' && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
              >
                {/* Table header — hidden on mobile */}
                <div
                  className="hidden xl:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400"
                  style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(248,250,252,0.8)' }}
                >
                  <span>Workspace</span>
                  <span className="text-center w-20">Plan</span>
                  <span className="text-center w-20">Status</span>
                  <span className="text-center w-24">Role</span>
                  <span className="w-16" />
                </div>

                {appWorkspaces.map((ws, idx) => {
                  const planStyle = PLAN_BADGE_STYLE[ws.plan] || PLAN_BADGE_STYLE.pro;
                  const statusStyle = STATUS_STYLE[ws.subscription_status] || STATUS_STYLE.inactive;
                  const statusLabel = STATUS_LABEL[ws.subscription_status] || ws.subscription_status;
                  const role = ws.role as 'owner' | 'admin' | 'member';
                  const RoleIcon = ROLE_ICONS[role] || User;
                  const roleColor = ROLE_COLORS[role] || '#64748b';
                  const isExpired = ws.subscription_status === 'inactive';
                  const isTrial = ws.subscription_status === 'trialing' && !ws.stripe_customer_id;
                  const daysLeft = isTrial ? daysUntil(ws.trial_workspace_expires_at) : null;
                  const expiryWarning = daysLeft !== null && daysLeft <= 7;
                  const isLast = idx === appWorkspaces.length - 1;

                  return (
                    <div
                      key={ws.id}
                      className="group cursor-pointer transition-all duration-150 hover:bg-slate-50"
                      style={!isLast ? { borderBottom: '1px solid rgba(15,23,42,0.06)' } : undefined}
                      onClick={() => onNavigate('workspace-hub', ws.id)}
                    >
                      {/* Alert strip */}
                      {(expiryWarning && !isExpired) && (
                        <div
                          className="flex items-center gap-2 px-6 py-2 text-xs font-semibold"
                          style={{ background: 'rgba(245,158,11,0.07)', borderBottom: '1px solid rgba(245,158,11,0.12)', color: '#b45309' }}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Trial expires in {daysLeft} day{daysLeft === 1 ? '' : 's'} — upgrade to keep this workspace active
                        </div>
                      )}
                      {isExpired && (
                        <div
                          className="flex items-center gap-2 px-6 py-2 text-xs font-semibold"
                          style={{ background: 'rgba(239,68,68,0.05)', borderBottom: '1px solid rgba(239,68,68,0.1)', color: '#dc2626' }}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Expired — this workspace is read-only. Upgrade to restore full access.
                        </div>
                      )}

                      {/* Mobile layout */}
                      <div className="xl:hidden p-5 flex items-center gap-4">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                          style={{ background: isExpired ? 'rgba(100,116,139,0.1)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
                        >
                          <Lock className={`w-5 h-5 ${isExpired ? 'text-slate-400' : 'text-white'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <h3 className={`text-sm font-bold truncate ${isExpired ? 'text-slate-400' : 'text-slate-900'}`}>{ws.name}</h3>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={planStyle}>{ws.plan}</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={statusStyle}>{statusLabel}</span>
                          </div>
                          {ws.description && <p className="text-xs text-slate-500 truncate">{ws.description}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <RoleIcon className="w-3 h-3" style={{ color: roleColor }} />
                              <span className="text-xs capitalize" style={{ color: roleColor }}>{role}</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400">
                              <Users className="w-3 h-3" />
                              <span className="text-xs">{ws.seats} seats</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {(role === 'owner' || role === 'admin') && (
                            <button
                              onClick={e => { e.stopPropagation(); onNavigate('workspace-settings', ws.id); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                        </div>
                      </div>

                      {/* Desktop table row */}
                      <div className="hidden xl:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 items-center px-6 py-4">
                        {/* Name + description */}
                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: isExpired ? 'rgba(100,116,139,0.1)' : 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
                          >
                            <Lock className={`w-4.5 h-4.5 ${isExpired ? 'text-slate-400' : 'text-white'}`} style={{ width: '1.125rem', height: '1.125rem' }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-bold truncate ${isExpired ? 'text-slate-400' : 'text-slate-900'}`}>{ws.name}</p>
                              {isTrial && daysLeft !== null && !expiryWarning && (
                                <span className="text-xs text-slate-400 flex-shrink-0">{daysLeft}d left</span>
                              )}
                            </div>
                            {ws.description
                              ? <p className="text-xs text-slate-400 truncate mt-0.5">{ws.description}</p>
                              : <p className="text-xs text-slate-300 mt-0.5">No description</p>
                            }
                          </div>
                        </div>

                        {/* Plan */}
                        <div className="w-20 flex justify-center">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize" style={planStyle}>{ws.plan}</span>
                        </div>

                        {/* Status */}
                        <div className="w-20 flex justify-center">
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={statusStyle}>{statusLabel}</span>
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
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Settings"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className="w-8 h-8 flex items-center justify-center">
                            <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upgrade banner when monthly limit reached */}
            {!isLoading && !isPro && monthlyLimitReached && appWorkspaces.length > 0 && view === 'list' && (
              <div
                className="rounded-2xl p-5 flex items-center gap-4"
                style={{ background: 'linear-gradient(135deg,#eff6ff,#f0fdfa)', border: '1px solid rgba(37,99,235,0.15)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)' }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Upgrade for unlimited workspaces</p>
                  <p className="text-xs text-slate-500 mt-0.5">Your free workspace resets {resetsOn}, or go Pro now for unlimited.</p>
                </div>
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
                >
                  Upgrade
                </button>
              </div>
            )}

            {/* Slack Sessions */}
            {!isLoading && view === 'list' && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(74,21,75,0.08)' }}
                  >
                    <MessageSquare className="w-4 h-4" style={{ color: '#4a154b' }} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Slack Sessions</h2>
                    <p className="text-xs text-slate-500">War Rooms generated from <code className="font-mono">/poddle</code> commands — each question gets its own isolated workspace.</p>
                  </div>
                </div>

                {slackWorkspaces.length === 0 ? (
                  <div
                    className="rounded-2xl p-6 flex items-center gap-4"
                    style={{ background: '#fff', border: '1px dashed rgba(15,23,42,0.12)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(74,21,75,0.07)' }}
                    >
                      <MessageSquare className="w-5 h-5" style={{ color: '#4a154b' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">No Slack sessions yet</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Use <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">/poddle &lt;your question&gt;</code> in Slack to generate a fresh War Room for any decision.
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
                          className="group flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all duration-150 hover:-translate-y-0.5"
                          style={{
                            background: '#fff',
                            border: '1px solid rgba(15,23,42,0.08)',
                            boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
                            opacity: isExpired ? 0.65 : 1,
                          }}
                          onClick={() => onNavigate('workspace-hub', ws.id)}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: isExpired ? 'rgba(100,116,139,0.1)' : 'rgba(74,21,75,0.1)' }}
                          >
                            <MessageSquare className="w-4 h-4" style={{ color: isExpired ? '#94a3b8' : '#4a154b' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${isExpired ? 'text-slate-400' : 'text-slate-800'}`}>{ws.name}</p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-slate-400">{formatDate(ws.created_at)}</span>
                              {daysLeft !== null && daysLeft > 0 && (
                                <span className="text-xs text-slate-400">· expires in {daysLeft}d</span>
                              )}
                              {isExpired && (
                                <span className="text-xs font-medium" style={{ color: '#dc2626' }}>· expired</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="hidden sm:inline text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(74,21,75,0.08)', color: '#4a154b' }}
                            >
                              Slack
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
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
                  { icon: Lock, title: 'End-to-end encrypted', desc: 'All workspace data encrypted at rest and in transit', color: '#2563eb', bg: 'rgba(37,99,235,0.07)' },
                  { icon: Zap, title: 'AI War Room', desc: 'Synthesize discussions into structured intelligence in under 60s', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)' },
                  { icon: Users, title: 'Team collaboration', desc: 'Invite members and assign roles — owner, admin, or member', color: '#16a34a', bg: 'rgba(22,163,74,0.07)' },
                ].map(({ icon: Icon, title, desc, color, bg }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 p-4 rounded-2xl"
                    style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: bg }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar — desktop only */}
          <div className="hidden xl:block">
            <div className="sticky top-[4.5rem]">
              <AskAgentsSidebar />
            </div>
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
