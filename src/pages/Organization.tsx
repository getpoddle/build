import { useState, useEffect } from 'react';
import { Building2, AlertTriangle, RefreshCw, ChevronRight, Plus, ShieldCheck, Check, X as XIcon, Pencil, Trash2, Mail, Copy, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OrganizationProps {
  onNavigate: (page: string, workspaceId?: string) => void;
}

interface OrgOption {
  id: string;
  name: string;
  role: string;
  require_approval_for_commit: boolean;
}

interface ApprovalRequest {
  id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_description: string;
  requested_by: string;
  requester_name: string;
  status: string;
  created_at: string;
}
interface PortfolioHealthRow {
  decision_status: string;
  workspace_count: number;
}

interface OverviewRow {
  workspace_id: string;
  workspace_name: string;
  decision_status: string;
  decision_category: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  exploring: 'Exploring',
  in_debate: 'In Debate',
  committed: 'Committed',
  implemented: 'Implemented',
  reviewed: 'Reviewed',
};

const STATUS_COLORS: Record<string, string> = {
  exploring: '#64748b',
  in_debate: '#d97706',
  committed: '#2563eb',
  implemented: '#16a34a',
  reviewed: '#7c3aed',
};

export default function Organization({ onNavigate }: OrganizationProps) {
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [health, setHealth] = useState<PortfolioHealthRow[]>([]);
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [togglingGovernance, setTogglingGovernance] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [savingOrgName, setSavingOrgName] = useState(false);
  const [orgNameError, setOrgNameError] = useState<string | null>(null);

  const [showDeleteOrgConfirm, setShowDeleteOrgConfirm] = useState(false);
  const [deleteOrgConfirmText, setDeleteOrgConfirmText] = useState('');
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [deleteOrgError, setDeleteOrgError] = useState<string | null>(null);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResults, setInviteResults] = useState<{ email: string; link: string }[]>([]);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; invited_email: string; token: string; created_at: string }[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
    loadOrgs();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      loadOrgData(selectedOrgId);
      loadApprovalRequests(selectedOrgId);
      loadPendingInvites(selectedOrgId);
    }
  }, [selectedOrgId]);

  async function loadOrgs() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in.'); return; }

      const { data, error: membersError } = await supabase
        .from('organization_members')
        .select('role, organizations(id, name, require_approval_for_commit)')
        .eq('user_id', user.id);

      if (membersError) throw membersError;

      const orgOptions: OrgOption[] = (data || [])
        .map((row: any) => row.organizations ? { ...row.organizations, role: row.role } : null)
        .filter(Boolean);

      setOrgs(orgOptions);
      if (orgOptions.length > 0) setSelectedOrgId(orgOptions[0].id);
      else setLoading(false);
    } catch (err) {
      setError('Could not load your organizations.');
      setLoading(false);
    }
  }

  async function loadOrgData(orgId: string) {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, overviewRes] = await Promise.all([
        supabase.rpc('get_organization_portfolio_health', { org_id: orgId }),
        supabase.rpc('get_organization_decision_overview', { org_id: orgId }),
      ]);

      if (healthRes.error) throw healthRes.error;
      if (overviewRes.error) throw overviewRes.error;

      setHealth(healthRes.data || []);
      setOverview(overviewRes.data || []);
    } catch (err) {
      setError('Could not load decision data for this organization.');
    } finally {
      setLoading(false);
    }
  }

  async function loadApprovalRequests(orgId: string) {
    const { data } = await supabase
      .from('decision_approvals')
      .select('id, workspace_id, requested_by, status, created_at, workspaces(name, description), profiles!decision_approvals_requested_by_fkey(full_name)')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const requests: ApprovalRequest[] = (data || []).map((row: any) => ({
      id: row.id,
      workspace_id: row.workspace_id,
      workspace_name: row.workspaces?.name || 'Unknown workspace',
      workspace_description: row.workspaces?.description || '',
      requested_by: row.requested_by,
      requester_name: row.profiles?.full_name || 'A team member',
      status: row.status,
      created_at: row.created_at,
    }));

    setApprovalRequests(requests);
  }

  async function loadPendingInvites(orgId: string) {
    const { data } = await supabase
      .from('organization_invites')
      .select('id, invited_email, token, created_at')
      .eq('organization_id', orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    setPendingInvites(data || []);
  }

   async function handleBulkInvite() {
    if (!selectedOrgId || !inviteEmails.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteResults([]);

    const emails = inviteEmails
      .split(/[,\n]/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (emails.length === 0) {
      setInviteError('Please enter at least one valid email address.');
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
        body: JSON.stringify({ organization_id: selectedOrgId, emails }),
      });

      const json = await res.json();

      if (json.error) {
        setInviteError(json.error);
      } else {
        const succeeded = (json.results || []).filter((r: { success: boolean }) => r.success).length;
        const failed = (json.results || []).length - succeeded;
        setInviteResults([]);
        if (succeeded > 0) {
          setInviteError(failed > 0 ? `${succeeded} email${succeeded !== 1 ? 's' : ''} sent, ${failed} failed.` : null);
        } else {
          setInviteError('No invites could be sent.');
        }
      }
    } catch {
      setInviteError('Failed to send invites. Please try again.');
    }

    setInviteEmails('');
    setInviting(false);
    loadPendingInvites(selectedOrgId);
  }

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/#join-org/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function handleRevokeInvite(inviteId: string) {
    await supabase.from('organization_invites').delete().eq('id', inviteId);
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
  }

  async function handleToggleGovernance(orgId: string, currentValue: boolean) {
    setTogglingGovernance(true);
    setGovernanceError(null);
    try {
      const { error: updateErr } = await supabase
        .from('organizations')
        .update({ require_approval_for_commit: !currentValue })
        .eq('id', orgId);
      if (updateErr) throw updateErr;
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, require_approval_for_commit: !currentValue } : o));
    } catch (err: any) {
      setGovernanceError(err?.message || 'Could not update this setting.');
    } finally {
      setTogglingGovernance(false);
    }
  }

  async function handleReviewRequest(requestId: string, decision: 'approved' | 'rejected') {
    setReviewingId(requestId);
    try {
      const { error: reviewErr } = await supabase
        .from('decision_approvals')
        .update({ status: decision, reviewed_by: currentUserId, reviewed_at: new Date().toISOString() })
        .eq('id', requestId);
      if (reviewErr) throw reviewErr;
      setApprovalRequests(prev => prev.filter(r => r.id !== requestId));
    } catch {
      // Leave the request visible; user can retry.
    } finally {
      setReviewingId(null);
    }
  }

  async function handleRenameOrg() {
    if (!currentOrg || !orgNameInput.trim() || savingOrgName) return;
    setSavingOrgName(true);
    setOrgNameError(null);
    try {
      const { error: renameErr } = await supabase
        .from('organizations')
        .update({ name: orgNameInput.trim() })
        .eq('id', currentOrg.id);
      if (renameErr) throw renameErr;
      setOrgs(prev => prev.map(o => o.id === currentOrg.id ? { ...o, name: orgNameInput.trim() } : o));
      setEditingName(false);
    } catch (err: any) {
      setOrgNameError(err?.message || 'Could not rename this organization.');
    } finally {
      setSavingOrgName(false);
    }
  }

  async function handleDeleteOrg() {
    if (!currentOrg || deleteOrgConfirmText !== currentOrg.name || deletingOrg) return;
    if (overview.length > 0) {
      setDeleteOrgError('Unlink all workspaces from this organization first, from each workspace\'s Settings page.');
      return;
    }
    const deletedId = currentOrg.id;
    setDeletingOrg(true);
    setDeleteOrgError(null);
    try {
      await supabase.from('organization_members').delete().eq('organization_id', deletedId);
      const { error: deleteErr } = await supabase.from('organizations').delete().eq('id', deletedId);
      if (deleteErr) throw deleteErr;

      setShowDeleteOrgConfirm(false);
      setDeleteOrgConfirmText('');

      // Update local state immediately instead of waiting on a full
      // re-fetch, so deletion feels instant rather than "rolling."
      setOrgs(prev => {
        const remaining = prev.filter(o => o.id !== deletedId);
        setSelectedOrgId(remaining.length > 0 ? remaining[0].id : null);
        return remaining;
      });
    } catch (err: any) {
      setDeleteOrgError(err?.message || 'Could not delete this organization.');
    } finally {
      setDeletingOrg(false);
    }
  }

  async function handleCreateOrg() {
    if (!newOrgName.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { data, error: createErr } = await supabase.rpc('create_organization', {
        p_name: newOrgName.trim(),
      });
      if (createErr) throw createErr;

      const created = Array.isArray(data) ? data[0] : data;
      setNewOrgName('');
      setShowCreateForm(false);

      // Refresh org list, then select the newly created one
      await loadOrgs();
      if (created?.id) setSelectedOrgId(created.id);
    } catch (err: any) {
      setCreateError(err?.message || 'Could not create organization.');
    } finally {
      setCreating(false);
    }
  }

  const totalWorkspaces = health.reduce((sum, row) => sum + Number(row.workspace_count), 0);
  const currentOrg = orgs.find(o => o.id === selectedOrgId) || null;
  const canManageGovernance = currentOrg?.role === 'owner' || currentOrg?.role === 'admin';

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div
        className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 mx-auto"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mb-6 lg:mb-10 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="section-label mb-2">Organization</p>
            <h1 className="display-heading text-2xl lg:text-3xl xl:text-4xl mb-1">
              Decision Overview
            </h1>
            {editingName && currentOrg ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={orgNameInput}
                  onChange={(e) => setOrgNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameOrg(); if (e.key === 'Escape') setEditingName(false); }}
                  autoFocus
                  className="text-sm font-semibold px-2 py-1"
                  style={{ border: '1px solid var(--app-border)', background: 'var(--app-bg)' }}
                />
                <button
                  onClick={handleRenameOrg}
                  disabled={savingOrgName || !orgNameInput.trim()}
                  className="text-xs font-semibold px-3 py-1.5 text-white disabled:opacity-50"
                  style={{ background: 'var(--signal, #2563eb)' }}
                >
                  {savingOrgName ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingName(false); setOrgNameError(null); }}
                  disabled={savingOrgName}
                  className="text-xs font-semibold px-3 py-1.5"
                  style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              currentOrg && (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: 'var(--app-text-secondary)' }}>
                    {currentOrg.name}
                  </p>
                  {canManageGovernance && (
                    <button
                      onClick={() => { setOrgNameInput(currentOrg.name); setEditingName(true); }}
                      className="p-1 flex-shrink-0"
                      style={{ color: 'var(--app-text-secondary)' }}
                      title="Rename organization"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            )}
            {orgNameError && (
              <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{orgNameError}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {orgs.length > 1 && (
              <select
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="text-sm font-semibold px-3 py-2"
                style={{ border: '1px solid var(--app-border)', background: 'var(--app-bg)', color: 'var(--app-text-primary)' }}
              >
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            )}
            {orgs.length > 0 && !showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2"
                style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-primary)' }}
              >
                <Plus className="w-4 h-4" />
                New org
              </button>
            )}
          </div>
        </div>

        {showCreateForm && (
          <div className="mb-6 p-4" style={{ border: '1px solid var(--app-border)', background: 'var(--app-bg)' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--app-text-primary)' }}>Create a new organization</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Organization name"
                className="flex-1 text-sm px-3 py-2"
                style={{ border: '1px solid var(--app-border)', background: 'var(--app-bg)', color: 'var(--app-text-primary)' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateOrg(); }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateOrg}
                  disabled={creating || !newOrgName.trim()}
                  className="text-sm font-semibold px-4 py-2 text-white disabled:opacity-50"
                  style={{ background: 'var(--signal, #2563eb)' }}
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowCreateForm(false); setCreateError(null); setNewOrgName(''); }}
                  disabled={creating}
                  className="text-sm font-semibold px-4 py-2"
                  style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
            {createError && (
              <p className="text-xs mt-2" style={{ color: '#dc2626' }}>{createError}</p>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--app-text-secondary)' }}>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 py-6 px-4" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && orgs.length === 0 && !showCreateForm && (
          <div className="flex flex-col items-center gap-4 py-16 text-center" style={{ color: 'var(--app-text-secondary)' }}>
            <Building2 className="w-8 h-8" style={{ opacity: 0.4 }} />
            <p className="text-sm">You're not part of any organization yet.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 text-white"
              style={{ background: 'var(--signal, #2563eb)' }}
            >
              <Plus className="w-4 h-4" />
              Create an organization
            </button>
          </div>
        )}

        {!loading && !error && orgs.length > 0 && (
          <>
            {/* Governance toggle */}
            {canManageGovernance && currentOrg && (
              <div className="mb-6 p-4 flex items-center justify-between gap-4" style={{ border: '1px solid var(--app-border)', background: 'var(--app-bg)' }}>
                <div className="flex items-start gap-3 min-w-0">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--app-text-secondary)' }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>Require approval before commit</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>
                      When on, decisions in this organization's workspaces need a fresh, org owner/admin-approved request before they can be marked Committed.
                    </p>
                    {governanceError && (
                      <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{governanceError}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleGovernance(currentOrg.id, currentOrg.require_approval_for_commit)}
                  disabled={togglingGovernance}
                  className="flex-shrink-0 text-xs font-bold px-3 py-2 disabled:opacity-50"
                  style={{
                    background: currentOrg.require_approval_for_commit ? 'var(--signal, #2563eb)' : 'var(--app-border-subtle, #f1f5f9)',
                    color: currentOrg.require_approval_for_commit ? '#fff' : 'var(--app-text-primary)',
                  }}
                >
                  {togglingGovernance ? 'Saving…' : currentOrg.require_approval_for_commit ? 'On' : 'Off'}
                </button>
              </div>
            )}

            {/* Invite members */}
            {canManageGovernance && (
              <div className="mb-6 p-4" style={{ border: '1px solid var(--app-border)', background: 'var(--app-bg)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: 'var(--app-text-secondary)' }}>
                    <Mail className="w-4 h-4" />
                    Invite Members
                  </h2>
                  {!showInviteForm && (
                    <button
                      onClick={() => setShowInviteForm(true)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5"
                      style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-primary)' }}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add people
                    </button>
                  )}
                </div>

                {showInviteForm && (
                  <div className="space-y-2 mb-3">
                    <textarea
                      value={inviteEmails}
                      onChange={e => setInviteEmails(e.target.value)}
                      placeholder="Enter email addresses, one per line or comma-separated"
                      rows={3}
                      className="w-full text-sm px-3 py-2"
                      style={{ border: '1px solid var(--app-border)', background: 'var(--app-bg)', color: 'var(--app-text-primary)' }}
                    />
                    {inviteError && (
                      <p className="text-xs" style={{ color: '#dc2626' }}>{inviteError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleBulkInvite}
                        disabled={inviting || !inviteEmails.trim()}
                        className="text-sm font-semibold px-4 py-2 text-white disabled:opacity-50"
                        style={{ background: 'var(--signal, #2563eb)' }}
                      >
                        {inviting ? 'Sending…' : 'Send invites'}
                      </button>
                      <button
                        onClick={() => { setShowInviteForm(false); setInviteError(null); setInviteEmails(''); setInviteResults([]); }}
                        disabled={inviting}
                        className="text-sm font-semibold px-4 py-2"
                        style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-secondary)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {inviteResults.length > 0 && (
                  <div className="mb-3 p-3 space-y-1.5" style={{ background: 'var(--app-border-subtle, rgba(0,0,0,0.03))' }}>
                    <p className="text-xs font-semibold" style={{ color: 'var(--app-text-primary)' }}>
                      {inviteResults.length} invite{inviteResults.length !== 1 ? 's' : ''} created — share these links:
                    </p>
                    {inviteResults.map(r => (
                      <div key={r.email} className="flex items-center gap-2 text-xs">
                        <span style={{ color: 'var(--app-text-secondary)' }}>{r.email}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(r.link)}
                          className="flex items-center gap-1 font-semibold"
                          style={{ color: 'var(--signal, #2563eb)' }}
                        >
                          <Copy className="w-3 h-3" />
                          Copy link
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {pendingInvites.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--app-text-muted, var(--app-text-secondary))' }}>
                      Pending invites
                    </p>
                    <div className="space-y-1.5">
                      {pendingInvites.map(inv => (
                        <div key={inv.id} className="flex items-center gap-3 px-3 py-2" style={{ background: 'var(--app-border-subtle, rgba(0,0,0,0.03))' }}>
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--app-text-muted)' }} />
                          <span className="text-xs flex-1 truncate" style={{ color: 'var(--app-text-primary)' }}>{inv.invited_email}</span>
                          <button
                            onClick={() => copyInviteLink(inv.token)}
                            className="p-1"
                            title="Copy invite link"
                          >
                            {copiedToken === inv.token ? <Check className="w-3.5 h-3.5" style={{ color: '#16a34a' }} /> : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--app-text-secondary)' }} />}
                          </button>
                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="p-1"
                            title="Revoke invite"
                          >
                            <XIcon className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pending approval requests */}
            {canManageGovernance && approvalRequests.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--app-text-secondary)' }}>
                  Pending approval requests
                </h2>
                <div className="space-y-2">
                  {approvalRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                      style={{ border: '1px solid var(--app-border)', background: 'var(--app-bg)' }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>{req.workspace_name}</p>
                        {req.workspace_description && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--app-text-secondary)' }}>
                            {req.workspace_description}
                          </p>
                        )}
                        <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted, var(--app-text-secondary))' }}>
                          Requested by {req.requester_name} · {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleReviewRequest(req.id, 'approved')}
                          disabled={reviewingId === req.id}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-2 text-white disabled:opacity-50"
                          style={{ background: '#16a34a' }}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReviewRequest(req.id, 'rejected')}
                          disabled={reviewingId === req.id}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-2 disabled:opacity-50"
                          style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-secondary)' }}
                        >
                          <XIcon className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-6 lg:mb-10">
              <div className="stat-card">
                <p className="stat-card-value">{totalWorkspaces}</p>
                <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>Total workspaces</p>
              </div>
              {Object.keys(STATUS_LABELS).map((statusKey) => {
                const row = health.find((h) => h.decision_status === statusKey);
                const count = row ? Number(row.workspace_count) : 0;
                return (
                  <div key={statusKey} className="stat-card">
                    <p className="stat-card-value" style={{ color: STATUS_COLORS[statusKey] }}>{count}</p>
                    <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>{STATUS_LABELS[statusKey]}</p>
                  </div>
                );
              })}
            </div>

            <div className="mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--app-text-secondary)' }}>
                Workspaces
              </h2>
            </div>
            {overview.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: 'var(--app-text-secondary)' }}>
                No workspaces are linked to this organization yet.
              </p>
            ) : (
              <div className="space-y-2">
                {overview.map((row) => (
                  <button
                    key={row.workspace_id}
                    onClick={() => onNavigate('workspace-hub', row.workspace_id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                    style={{ border: '1px solid var(--app-border)', background: 'var(--app-surface, transparent)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--app-bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--app-surface, transparent)'}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>{row.workspace_name}</p>
                      <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>{row.decision_category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold px-2.5 py-1"
                        style={{
                          color: STATUS_COLORS[row.decision_status] || '#64748b',
                          background: `${STATUS_COLORS[row.decision_status] || '#64748b'}1a`,
                        }}
                      >
                        {STATUS_LABELS[row.decision_status] || row.decision_status}
                      </span>
                      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--app-text-secondary)' }} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {canManageGovernance && currentOrg && (
              <div className="mt-10 p-4" style={{ border: '1px solid #dc2626' }}>
                <h2 className="text-sm font-bold flex items-center gap-2 mb-1" style={{ color: '#dc2626' }}>
                  <AlertTriangle className="w-4 h-4" />
                  Danger Zone
                </h2>
                {!showDeleteOrgConfirm ? (
                  <div className="flex items-center justify-between gap-4 p-3 mt-3" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>Delete this organization</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>
                        {overview.length > 0
                          ? `Unlink all ${overview.length} linked workspace(s) first, from each workspace's Settings page.`
                          : 'Permanently removes this organization. Irreversible.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDeleteOrgConfirm(true)}
                      disabled={overview.length > 0}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 flex-shrink-0 disabled:opacity-40"
                      style={{ border: '1px solid #dc2626', color: '#dc2626' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 mt-3">
                    {deleteOrgError && (
                      <p className="text-xs font-medium" style={{ color: '#dc2626' }}>{deleteOrgError}</p>
                    )}
                    <p className="text-sm" style={{ color: 'var(--app-text-primary)' }}>
                      Type <strong>{currentOrg.name}</strong> to confirm. This cannot be undone.
                    </p>
                    <input
                      type="text"
                      value={deleteOrgConfirmText}
                      onChange={(e) => setDeleteOrgConfirmText(e.target.value)}
                      placeholder={currentOrg.name}
                      className="text-sm px-3 py-2 w-full"
                      style={{ border: '1px solid #dc2626', background: 'var(--app-bg)' }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowDeleteOrgConfirm(false); setDeleteOrgConfirmText(''); setDeleteOrgError(null); }}
                        className="text-sm font-semibold px-4 py-2"
                        style={{ border: '1px solid var(--app-border)', color: 'var(--app-text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteOrg}
                        disabled={deleteOrgConfirmText !== currentOrg.name || deletingOrg}
                        className="text-sm font-semibold px-4 py-2 text-white disabled:opacity-50"
                        style={{ background: '#dc2626' }}
                      >
                        {deletingOrg ? 'Deleting…' : 'Delete Forever'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
