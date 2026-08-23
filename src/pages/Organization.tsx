import { useState, useEffect } from 'react';
import { Building2, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

export default function Organization() {
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [health, setHealth] = useState<PortfolioHealthRow[]>([]);
  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin']);

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
        </div>

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

        {!loading && !error && orgs.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center" style={{ color: 'var(--app-text-secondary)' }}>
            <Building2 className="w-8 h-8" style={{ opacity: 0.4 }} />
            <p className="text-sm">You're not an owner or admin of any organization.</p>
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
                  <div
                    key={row.workspace_id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ border: '1px solid var(--app-border)', background: 'var(--app-surface, transparent)' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--app-text-primary)' }}>{row.workspace_name}</p>
                      <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>{row.decision_category}</p>
                    </div>
                    <span
                      className="text-xs font-bold px-2.5 py-1"
                      style={{
                        color: STATUS_COLORS[row.decision_status] || '#64748b',
                        background: `${STATUS_COLORS[row.decision_status] || '#64748b'}1a`,
                      }}
                    >
                      {STATUS_LABELS[row.decision_status] || row.decision_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
