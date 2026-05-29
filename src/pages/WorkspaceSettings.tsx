import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Lock, Users, Mail, Trash2, Crown, Shield, User, X, ExternalLink, Copy, Check, AlertTriangle, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspaceAccess } from '../hooks/useWorkspaceAccess';

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
    email: string;
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

const ROLE_ICONS = { owner: Crown, admin: Shield, member: User };
const ROLE_COLORS = { owner: '#f59e0b', admin: '#2563eb', member: '#64748b' };

export default function WorkspaceSettings({ workspaceId, onBack, onNavigate }: WorkspaceSettingsProps) {
  const { user } = useAuth();
  const { isAdmin, isOwner, seatsUsed, seatsTotal, loading: accessLoading } = useWorkspaceAccess(workspaceId);

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

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);

  const fetchData = useCallback(async () => {
    const [wsRes, membersRes, invitesRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
      supabase
        .from('workspace_members')
        .select('id, user_id, role, joined_at, profiles(full_name, email, avatar_url, username)')
        .eq('workspace_id', workspaceId)
        .order('joined_at'),
      supabase
        .from('workspace_invites')
        .select('id, invited_email, token, expires_at, created_at')
        .eq('workspace_id', workspaceId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
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
    const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
    if (!error) {
      onBack();
    } else {
      setDeleting(false);
      setDeleteConfirmText('');
      setShowDeleteConfirm(false);
    }
  }

  async function handleBillingPortal() {
    if (!workspace?.stripe_customer_id) return;
    setLoadingBilling(true);
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
      if (json.url) window.open(json.url, '_blank');
    } catch {}
    setLoadingBilling(false);
  }

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/join/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!workspace || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Access restricted</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to workspace
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
          >
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{workspace.name}</h1>
            <p className="text-sm text-slate-500 capitalize">{workspace.plan} · {workspace.subscription_status}</p>
          </div>
        </div>

        {/* General settings */}
        <section className="bg-white rounded-2xl p-6 mb-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Workspace Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                disabled={!isOwner}
                className="w-full px-3 py-2.5 rounded-xl text-sm border text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ borderColor: 'rgba(15,23,42,0.12)', background: isOwner ? '#fafafa' : '#f1f5f9' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                disabled={!isOwner}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl text-sm border text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                style={{ borderColor: 'rgba(15,23,42,0.12)', background: isOwner ? '#fafafa' : '#f1f5f9' }}
              />
            </div>
            {isOwner && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        </section>

        {/* Members */}
        <section className="bg-white rounded-2xl p-6 mb-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Users className="w-4 h-4" />
              Members <span className="text-slate-400 font-normal normal-case">({seatsUsed}/{seatsTotal})</span>
            </h2>
          </div>
          <div className="space-y-2">
            {members.map(m => {
              const RoleIcon = ROLE_ICONS[m.role];
              const roleColor = ROLE_COLORS[m.role];
              const isCurrentUser = m.user_id === user?.id;

              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8fafc' }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
                  >
                    {(m.profile?.full_name || m.profile?.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {m.profile?.full_name || m.profile?.email}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs text-slate-400">(you)</span>
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
                          className="text-xs border rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ borderColor: 'rgba(15,23,42,0.15)' }}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                      <button
                        onClick={() => handleRemoveMember(m.id, m.user_id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
        <section className="bg-white rounded-2xl p-6 mb-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4" />
            Invite Members
          </h2>
          <div className="space-y-3">
            <textarea
              value={inviteEmails}
              onChange={e => setInviteEmails(e.target.value)}
              placeholder="Enter email addresses, one per line or comma-separated"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-sm border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fafafa' }}
            />
            {inviteError && (
              <p className="text-xs text-red-600 font-medium">{inviteError}</p>
            )}
            {inviteSuccess && (
              <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> {inviteSuccess}
              </p>
            )}
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmails.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
            >
              {inviting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Send Invites
            </button>
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pending Invites</p>
              <div className="space-y-2">
                {invites.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 flex-1 truncate">{inv.invited_email}</span>
                    <button
                      onClick={() => copyInviteLink(inv.token)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Copy invite link"
                    >
                      {copiedToken === inv.token ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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

        {/* Billing */}
        {isOwner && workspace.stripe_customer_id && (
          <section className="bg-white rounded-2xl p-6 mb-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Billing</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 capitalize">{workspace.plan} Plan</p>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">Status: {workspace.subscription_status} · {workspace.seats} seats</p>
              </div>
              <button
                onClick={handleBillingPortal}
                disabled={loadingBilling}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
                style={{ borderColor: 'rgba(15,23,42,0.12)' }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {loadingBilling ? 'Opening…' : 'Manage Billing'}
              </button>
            </div>
          </section>
        )}

        {/* Danger zone — visible to owners and admins only */}
        {isAdmin && (
          <section className="bg-white rounded-2xl p-6" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <h2 className="text-sm font-bold text-red-600 uppercase tracking-wide flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h2>
            <p className="text-xs text-slate-400 mb-4">Only workspace owners and admins can perform these actions.</p>
            {!showDeleteConfirm ? (
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Delete this workspace</p>
                  <p className="text-xs text-slate-500 mt-0.5">Permanently removes the workspace, all messages, and intelligence data. Irreversible.</p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors flex-shrink-0 ml-4"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  Type <strong>{workspace.name}</strong> to confirm. This cannot be undone.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={workspace.name}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  style={{ borderColor: 'rgba(239,68,68,0.3)', background: '#fafafa' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border text-slate-700 hover:bg-slate-50 transition-colors"
                    style={{ borderColor: 'rgba(15,23,42,0.12)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteConfirmText !== workspace.name || deleting}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40"
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
