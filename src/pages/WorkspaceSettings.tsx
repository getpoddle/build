import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Lock, Users, Mail, Trash2, Crown, Shield, User, X, ExternalLink, Copy, Check, AlertTriangle, Plus, CreditCard, Zap, Link2, Unlink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspaceAccess } from '../hooks/useWorkspaceAccess';
import { useSubscription } from '../hooks/useSubscription';

interface WorkspaceSettingsProps {
  workspaceId: string;
  onBack: () => void;
  onNavigate: (page: string) => void;
}

interface Member {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  };
}

interface Invite {
  id: string;
  invited_email: string;
  token: string;
  expires_at: string;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string;
  domain: string;
  plan: string;
  subscription_status: string;
  seats: number;
  stripe_customer_id: string | null;
  owner_id: string;
}

interface SlackConnection {
  id: string;
  slack_team_id: string;
  slack_team_name: string | null;
  created_at: string;
}

const ROLE_ICONS = { owner: Crown, admin: Shield, member: User };
const ROLE_COLORS = { owner: 'var(--signal)', admin: 'var(--agent-fin)', member: 'var(--app-text-muted)' };

export default function WorkspaceSettings({ workspaceId, onBack, onNavigate }: WorkspaceSettingsProps) {
  const { user } = useAuth();
  const { isAdmin, isOwner, seatsUsed, seatsTotal, loading: accessLoading } = useWorkspaceAccess(workspaceId);
  const subscription = useSubscription(user?.id);

  const cancelDate = subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmails, setInviteEmails] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);

  const [slackConnection, setSlackConnection] = useState<SlackConnection | null>(null);
  const [disconnectingSlack, setDisconnectingSlack] = useState(false);
  const [connectingSlack, setConnectingSlack] = useState(false);
  const [slackError, setSlackError] = useState('');

  const fetchData = useCallback(async () => {
    const [wsRes, membersRes, invitesRes, slackRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
      supabase
        .from('workspace_members')
        .select('id, user_id, role, joined_at, profiles(full_name, avatar_url, username)')
        .eq('workspace_id', workspaceId)
        .order('joined_at'),
      supabase
        .from('workspace_invites')
        .select('id, invited_email, token, expires_at, created_at')
        .eq('workspace_id', workspaceId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('slack_workspaces')
        .select('id, slack_team_id, slack_team_name, created_at')
        .eq('poddle_workspace_id', workspaceId)
        .maybeSingle(),
    ]);

    if (wsRes.data) {
      setWorkspace(wsRes.data);
      setEditName(wsRes.data.name);
      setEditDesc(wsRes.data.description || '');
    }

    setMembers(
      (membersRes.data || []).map(m => ({
        ...m,
        profile: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
      })) as Member[]
    );
    setInvites(invitesRes.data || []);
    setSlackConnection(slackRes.data ?? null);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave() {
    if (!workspace) return;
    setSaving(true);
    await supabase
      .from('workspaces')
      .update({ name: editName.trim(), description: editDesc.trim() })
      .eq('id', workspaceId);
    setWorkspace(prev => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() } : prev);
    setSaving(false);
  }

  async function handleInvite() {
    if (!inviteEmails.trim()) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    const emails = inviteEmails
      .split(/[,\n]/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (emails.length === 0) {
      setInviteError('Please enter valid email addresses.');
      setInviting(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-workspace-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ workspace_id: workspaceId, emails }),
      });

      const json = await res.json();

      if (json.error) {
        setInviteError(json.error);
      } else {
        const succeeded = (json.results || []).filter((r: { success: boolean }) => r.success).length;
        setInviteSuccess(`${succeeded} invite${succeeded !== 1 ? 's' : ''} sent.`);
        setInviteEmails('');
        fetchData();
      }
    } catch {
      setInviteError('Failed to send invites. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    await supabase.from('workspace_invites').delete().eq('id', inviteId);
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  }

  async function handleRemoveMember(memberId: string, userId: string) {
    if (userId === user?.id) return;
    await supabase.from('workspace_members').delete().eq('id', memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  }

  async function handleChangeRole(memberId: string, newRole: 'admin' | 'member') {
    await supabase.from('workspace_members').update({ role: newRole }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  }

  async function handleDelete() {
    if (!workspace || deleteConfirmText !== workspace.name) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await Promise.all([
        supabase.from('workspace_messages').delete().eq('workspace_id', workspaceId),
        supabase.from('workspace_invites').delete().eq('workspace_id', workspaceId),
        supabase.from('workspace_members').delete().eq('workspace_id', workspaceId),
        supabase.from('workspace_synthesis').delete().eq('workspace_id', workspaceId),
        supabase.from('workspace_chat_threads').delete().eq('workspace_id', workspaceId),
        supabase.from('workspace_decision_links').delete().eq('workspace_id', workspaceId),
        supabase.from('slack_workspaces').delete().eq('poddle_workspace_id', workspaceId),
      ]);
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
      if (error) throw error;
      onBack();
    } catch {
      setDeleting(false);
      setDeleteError('Failed to delete workspace. Please try again.');
    }
  }

  async function openBillingPortal(setLoading: (v: boolean) => void) {
    if (!workspace?.stripe_customer_id) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/create-billing-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          return_url: window.location.href,
        }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } catch {}
    setLoading(false);
  }

  const handleBillingPortal = () => openBillingPortal(setLoadingBilling);
  const handleCancelPortal = () => openBillingPortal(setLoadingCancel);

  async function handleSlackConnect() {
    setConnectingSlack(true);
    setSlackError('');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/slack-start-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ workspace_id: workspaceId, user_id: user?.id }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        setSlackError(json.error ?? 'Failed to start Slack connection.');
        setConnectingSlack(false);
      }
    } catch {
      setSlackError('Network error. Please try again.');
      setConnectingSlack(false);
    }
  }

  async function handleSlackDisconnect() {
    if (!slackConnection) return;
    setDisconnectingSlack(true);
    await supabase.from('slack_workspaces').delete().eq('id', slackConnection.id);
    setSlackConnection(null);
    setDisconnectingSlack(false);
  }

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/#join/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--signal)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!workspace || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--app-bg)' }}>
        <div className="text-center">
          <Lock className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--app-text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--app-text-secondary)' }}>Access restricted</p>
        </div>
      </div>
    );
  }

  const statusColor = workspace.subscription_status === 'active' ? 'var(--positive)' : workspace.subscription_status === 'cancelled' ? 'var(--app-text-muted)' : workspace.subscription_status === 'past_due' ? 'var(--caution)' : 'var(--signal)';
  const statusBg = workspace.subscription_status === 'active' ? 'var(--positive-bg)' : workspace.subscription_status === 'cancelled' ? 'var(--app-border-subtle)' : workspace.subscription_status === 'past_due' ? 'rgba(245,158,11,0.08)' : 'var(--signal-bg)';
  const statusLabel = workspace.subscription_status === 'active' ? 'Active' : workspace.subscription_status === 'cancelled' ? 'Cancelled' : workspace.subscription_status === 'past_due' ? 'Past due' : workspace.subscription_status;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--app-bg)', minHeight: '100vh' }}>
      <div className="max-w-2xl mx-auto px-4 py-8" style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Back */}
        <button
          onClick={onBack}
          className="btn-ghost mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to workspace
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 flex items-center justify-center" style={{ background: 'var(--app-surface-raised)', border: '1px solid var(--app-border)' }}>
            <Lock className="w-6 h-6" style={{ color: 'var(--signal)' }} />
          </div>
          <div>
            <h1 className="display-heading text-2xl">{workspace.name}</h1>
            <p className="text-sm capitalize mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>{workspace.plan} · {workspace.subscription_status}</p>
          </div>
        </div>

        {/* General settings */}
        <section className="panel p-6 mb-4">
          <p className="section-label mb-4">General</p>
          <div className="space-y-4">
            <div>
              <label className="block section-label mb-1.5">Workspace Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                disabled={!isOwner}
                className="input-modern"
              />
            </div>
            <div>
              <label className="block section-label mb-1.5">Description</label>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                disabled={!isOwner}
                rows={2}
                className="input-modern"
              />
            </div>
            {isOwner && (
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        </section>

        {/* Members */}
        <section className="panel p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-label flex items-center gap-2">
              <Users className="w-4 h-4" />
              Members <span style={{ color: 'var(--app-text-muted)' }} className="normal-case font-normal">({seatsUsed}/{seatsTotal})</span>
            </h2>
          </div>
          <div className="space-y-2">
            {members.map(m => {
              const RoleIcon = ROLE_ICONS[m.role];
              const roleColor = ROLE_COLORS[m.role];
              const isCurrentUser = m.user_id === user?.id;

              return (
                <div key={m.id} className="flex items-center gap-3 p-3" style={{ background: 'var(--app-border-subtle)' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold" style={{ background: 'var(--app-surface-raised)', color: 'var(--signal)', border: '1px solid var(--app-border)' }}>
                    {(m.profile?.full_name || m.profile?.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--app-text-primary)' }}>
                        {m.profile?.full_name || m.profile?.username || 'Member'}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>(you)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <RoleIcon className="w-3 h-3" style={{ color: roleColor }} />
                      <span className="text-xs capitalize" style={{ color: roleColor }}>{m.role}</span>
                    </div>
                  </div>
                  {isAdmin && !isCurrentUser && m.role !== 'owner' && (
                    <div className="flex items-center gap-1">
                      {isOwner && (
                        <select
                          value={m.role}
                          onChange={e => handleChangeRole(m.id, e.target.value as 'admin' | 'member')}
                          className="text-xs input-modern"
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                      <button
                        onClick={() => handleRemoveMember(m.id, m.user_id)}
                        className="btn-ghost p-1.5"
                        style={{ color: 'var(--negative)' }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Invite */}
        <section className="panel p-6 mb-4">
          <h2 className="section-label flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4" />
            Invite Members
          </h2>
          <div className="space-y-3">
            <textarea
              value={inviteEmails}
              onChange={e => setInviteEmails(e.target.value)}
              placeholder="Enter email addresses, one per line or comma-separated"
              rows={3}
              className="input-modern"
            />
            {inviteError && (
              <p className="text-xs font-medium" style={{ color: 'var(--negative)' }}>{inviteError}</p>
            )}
            {inviteSuccess && (
              <p className="text-xs font-medium flex items-center gap-1 text-positive">
                <Check className="w-3.5 h-3.5" /> {inviteSuccess}
              </p>
            )}
            <button onClick={handleInvite} disabled={inviting || !inviteEmails.trim()} className="btn-primary">
              {inviting ? (
                <span className="w-4 h-4 border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ink-900)', borderTopColor: 'transparent' }} />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Send Invites
            </button>
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="mt-4">
              <p className="section-label mb-2">Pending Invites</p>
              <div className="space-y-2">
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 p-2.5 panel">
                    <Mail className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--app-text-muted)' }} />
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--app-text-primary)' }}>{inv.invited_email}</span>
                    <button
                      onClick={() => copyInviteLink(inv.token)}
                      className="btn-ghost p-1.5"
                      title="Copy invite link"
                    >
                      {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-positive" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="btn-ghost p-1.5"
                      style={{ color: 'var(--negative)' }}
                      title="Revoke invite"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Billing — always visible to owner */}
        {isOwner && (
          <section className="panel p-6 mb-4">
            <h2 className="section-label flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4" />
              Billing
            </h2>

            {workspace.stripe_customer_id ? (
              <>
                {/* Plan details */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold" style={{ color: 'var(--app-text-primary)' }}>
                        {workspace.plan === 'pro' ? 'Pro Individual' : workspace.plan === 'team' ? 'Poddle Team' : workspace.plan} Plan
                      </p>
                      <span className="badge" style={{ background: statusBg, color: statusColor, borderColor: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>{workspace.seats} seats included</p>
                    {subscription.cancelAtPeriodEnd && cancelDate ? (
                      <p className="text-xs mt-1.5" style={{ color: 'var(--app-text-muted)' }}>
                        Your subscription is scheduled to cancel on {cancelDate}. You'll keep full access until then.
                      </p>
                    ) : workspace.subscription_status === 'cancelled' && (
                      <p className="text-xs mt-1.5" style={{ color: 'var(--app-text-muted)' }}>
                        Your workspace stays active until the end of the current billing period.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleBillingPortal}
                    disabled={loadingBilling}
                    className="btn-secondary flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {loadingBilling ? 'Opening…' : 'Manage Billing'}
                  </button>
                </div>

                {/* Cancel — only visible for active subscriptions */}
                {workspace.subscription_status === 'active' && !showCancelConfirm && (
                  <div className="flex items-center justify-between p-4" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>Cancel subscription</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>
                        {subscription.cancelAtPeriodEnd && cancelDate
                          ? `Scheduled to cancel on ${cancelDate}. You can resubscribe at any time.`
                          : 'You\'ll keep full access until the end of your billing period.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="btn-secondary flex-shrink-0 ml-4"
                      style={{ borderColor: 'var(--negative)', color: 'var(--negative)' }}
                    >
                      Cancel plan
                    </button>
                  </div>
                )}

                {/* Cancel confirmation */}
                {workspace.subscription_status === 'active' && showCancelConfirm && (
                  <div className="p-4 space-y-3" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--negative)' }} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--app-text-primary)' }}>Cancel your subscription?</p>
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
                          Your workspace stays fully active until the end of the current billing period, then becomes read-only. You can resubscribe at any time.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowCancelConfirm(false)} className="btn-secondary">
                        Keep subscription
                      </button>
                      <button
                        onClick={handleCancelPortal}
                        disabled={loadingCancel}
                        className="btn-primary"
                        style={{ background: 'var(--negative)', borderColor: 'var(--negative)', color: 'var(--ink-900)' }}
                      >
                        {loadingCancel && (
                          <span className="w-3.5 h-3.5 border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ink-900)', borderTopColor: 'transparent' }} />
                        )}
                        {loadingCancel ? 'Redirecting…' : 'Yes, cancel subscription'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Free trial workspace — show upgrade CTA */
              <div className="flex items-center gap-4 p-4" style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}>
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: 'var(--signal)' }}>
                  <CreditCard className="w-5 h-5" style={{ color: 'var(--ink-900)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--app-text-primary)' }}>Free trial workspace</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>
                    {workspace.subscription_status === 'inactive'
                      ? 'This workspace has expired. Upgrade to Pro to restore full access.'
                      : 'Expires end of month. Upgrade to Pro for unlimited, permanent workspaces.'}
                  </p>
                </div>
                <button onClick={() => onNavigate('pricing')} className="btn-primary flex-shrink-0">
                  Upgrade
                </button>
              </div>
            )}
          </section>
        )}

        {/* Slack integration — visible to owners and admins */}
        {isAdmin && (
          <section className="panel p-6 mb-4">
            <h2 className="section-label flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4" />
              Integrations
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--app-text-muted)' }}>Connect external tools to your workspace.</p>

            <div className="p-4 panel">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: '#4a154b' }}>
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold" style={{ color: 'var(--app-text-primary)' }}>Slack</p>
                    {slackConnection && (
                      <span className="badge badge-green">Connected</span>
                    )}
                  </div>
                  {slackConnection ? (
                    <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                      {slackConnection.slack_team_name
                        ? `${slackConnection.slack_team_name} · `
                        : ''}
                      Connected {new Date(slackConnection.created_at).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                      Use <code className="mono-xs" style={{ background: 'var(--app-border-subtle)', padding: '0.125rem 0.375rem' }}>/poddle</code> in any channel to kick off a War Room session.
                    </p>
                  )}
                </div>
                {slackConnection ? (
                  <button
                    onClick={handleSlackDisconnect}
                    disabled={disconnectingSlack}
                    className="btn-secondary flex-shrink-0"
                    style={{ borderColor: 'var(--negative)', color: 'var(--negative)', padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    {disconnectingSlack ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    onClick={handleSlackConnect}
                    disabled={connectingSlack}
                    className="btn-primary flex-shrink-0"
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    {connectingSlack ? (
                      <span className="w-3.5 h-3.5 border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ink-900)', borderTopColor: 'transparent' }} />
                    ) : (
                      <Link2 className="w-3.5 h-3.5" />
                    )}
                    {connectingSlack ? 'Connecting…' : 'Connect Slack'}
                  </button>
                )}
              </div>

              {slackError && (
                <p className="mt-2 text-xs font-medium" style={{ color: 'var(--negative)' }}>{slackError}</p>
              )}

              {slackConnection && (
                <div className="mt-3 p-3" style={{ background: 'var(--app-border-subtle)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--app-text-secondary)' }}>Slash command</p>
                  <div className="flex items-center gap-2">
                    <code className="mono-xs flex-1 px-2.5 py-1.5 overflow-x-auto" style={{ background: 'var(--app-surface-raised)', color: 'var(--app-text-primary)' }}>
                      /poddle should we raise the enterprise price by 15%?
                    </code>
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--app-text-muted)' }}>
                    Type <code className="mono-xs">/poddle</code> followed by your decision question in any channel. Poddle will run a full War Room analysis and post the Board Brief back to that channel.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Danger zone — visible to owners and admins only */}
        {isAdmin && (
          <section className="panel p-6" style={{ borderColor: 'var(--negative)' }}>
            <h2 className="section-label flex items-center gap-2 mb-1" style={{ color: 'var(--negative)' }}>
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--app-text-muted)' }}>Only workspace owners and admins can perform these actions.</p>
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between p-4" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>Delete this workspace</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>Permanently removes the workspace, all messages, and intelligence data. Irreversible.</p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-secondary flex-shrink-0 ml-4"
                  style={{ borderColor: 'var(--negative)', color: 'var(--negative)' }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {deleteError && (
                  <p className="text-xs font-medium" style={{ color: 'var(--negative)' }}>{deleteError}</p>
                )}
                <p className="text-sm" style={{ color: 'var(--app-text-primary)' }}>
                  Type <strong>{workspace.name}</strong> to confirm. This cannot be undone.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={workspace.name}
                  className="input-modern"
                  style={{ borderColor: 'var(--negative)' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteConfirmText !== workspace.name || deleting}
                    className="btn-primary"
                    style={{ background: 'var(--negative)', borderColor: 'var(--negative)', color: 'var(--ink-900)' }}
                  >
                    {deleting ? 'Deleting…' : 'Delete Forever'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
