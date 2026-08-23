import { useState, useEffect } from 'react';
import { Building2, AlertTriangle, RefreshCw, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OrganizationProps {
  onNavigate: (page: string, workspaceId?: string) => void;
}

interface OrgOption {
  id: string;
  name: string;
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

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    if (selectedOrgId) loadOrgData(selectedOrgId);
  }, [selectedOrgId]);

  async function loadOrgs() {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in.'); return; }

      const { data, error: membersError } = await supabase
        .from('organization_members')
        .select('role, organizations(id, name)')
        .eq('user_id', user.id);

      if (membersError) throw membersError;

      const orgOptions: OrgOption[] = (data || [])
        .map((row: any) => row.organizations)
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div
        className="px-4 sm:px-6 lg:px-8 py-6 lg:py-10 mx-auto"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mb-6 lg:mb-10 flex items-center justify-between">
          <div>
            <p className="section-label mb-2">Organization</p>
            <h1 className="display-heading text-2xl lg:text-3xl xl:text-4xl mb-1">
              Decision Overview
            </h1>
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
          </>
        )}
      </div>
    </div>
  );
}
