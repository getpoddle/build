import { useState } from 'react';
import { Lock, Plus, Settings, Users, ArrowRight, Crown, Shield, User, Sparkles, Brain, Clock, AlertTriangle, ChevronRight, Zap } from 'lucide-react';
import { useUserWorkspaces, useSubscriptionTier, useTrialInfo } from '../hooks/useWorkspaceAccess';
import CreateWorkspace from '../components/CreateWorkspace';
import UpgradePrompt from '../components/UpgradePrompt';

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
  const { workspaces, loading, refetch } = useUserWorkspaces();
  const { isPro } = useSubscriptionTier();
  const { trialExhausted, monthlyLimitReached, resetsOn, expiresOn, loading: trialLoading } = useTrialInfo();
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  function handleCreateClick() {
    if (!isPro && trialExhausted) {
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

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="max-w-screen-xl mx-auto px-6 lg:px-10 py-8 lg:py-10">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 mb-1">Private Workspaces</h1>
            <p className="text-slate-500 text-sm">Encrypted spaces where your team debates proprietary ideas with AI agents.</p>
          </div>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 self-start sm:flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
          >
            {!isPro && trialExhausted ? <Sparkles className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {!isPro && trialExhausted ? 'Upgrade to Create' : 'New Workspace'}
          </button>
        </div>

        {/* Monthly workspace status banner */}
        {!isLoading && !isPro && monthlyLimitReached && (
          <div
            className="mb-6 flex items-center gap-3 px-5 py-3.5 rounded-2xl"
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
        {!isLoading && workspaces.length === 0 && (
          <div
            className="rounded-2xl p-12 lg:p-16 text-center"
            style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)' }}
          >
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
            >
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">No private workspaces yet</h2>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
              1 free workspace every month — no credit card needed. Full Pro features until the end of the month, including encrypted team spaces and AI War Room.
            </p>
            <div className="grid grid-cols-3 gap-6 max-w-md mx-auto mb-10">
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

        {/* Workspace list — desktop table-style */}
        {!isLoading && workspaces.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 4px rgba(15,23,42,0.04)' }}
          >
            {/* Table header — hidden on mobile */}
            <div
              className="hidden lg:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400"
              style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(248,250,252,0.8)' }}
            >
              <span>Workspace</span>
              <span className="text-center w-20">Plan</span>
              <span className="text-center w-20">Status</span>
              <span className="text-center w-24">Role</span>
              <span className="w-16" />
            </div>

            {workspaces.map((ws, idx) => {
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
              const isLast = idx === workspaces.length - 1;

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
                  <div className="lg:hidden p-5 flex items-center gap-4">
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
                  <div className="hidden lg:grid grid-cols-[1fr_auto_auto_auto_auto] gap-6 items-center px-6 py-4">
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
        {!isLoading && !isPro && monthlyLimitReached && workspaces.length > 0 && (
          <div
            className="mt-6 rounded-2xl p-5 flex items-center gap-4"
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

        {/* Feature callout strip */}
        {!isLoading && (
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
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
