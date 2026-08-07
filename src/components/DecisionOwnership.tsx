import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, UserCog, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DomainOwner {
  id: string;
  domain: string;
  category_key: string;
  owner_user_id: string | null;
  backup_owner_user_id: string | null;
}

interface Member {
  id: string;
  user_id: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  };
}

interface DecisionOwnershipProps {
  workspaceId: string;
  members: Member[];
}

const DEFAULT_CATEGORY_MAP: Record<string, string> = {
  Finance: 'financial',
  Marketing: 'other',
  Product: 'product',
  Legal: 'other',
  Operations: 'operational',
  People: 'people',
  Strategy: 'strategic',
};

export default function DecisionOwnership({ workspaceId, members }: DecisionOwnershipProps) {
  const [domains, setDomains] = useState<DomainOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newDomainName, setNewDomainName] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);

  const fetchDomains = useCallback(async () => {
    const { data } = await supabase
      .from('domain_owners')
      .select('id, domain, category_key, owner_user_id, backup_owner_user_id')
      .eq('workspace_id', workspaceId)
      .order('domain');
    setDomains(data || []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetchDomains(); }, [fetchDomains]);

  async function updateOwner(domainId: string, field: 'owner_user_id' | 'backup_owner_user_id', value: string | null) {
    setSaving(domainId + field);
    setError('');
    const { error: err } = await supabase
      .from('domain_owners')
      .update({ [field]: value || null })
      .eq('id', domainId);
    if (err) {
      setError('Failed to update owner.');
    } else {
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, [field]: value || null } : d));
    }
    setSaving(null);
  }

  async function renameDomain(domainId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(domainId + 'rename');
    setError('');
    const { error: err } = await supabase
      .from('domain_owners')
      .update({ domain: trimmed })
      .eq('id', domainId);
    if (err) {
      setError(err.code === '23505' ? 'A domain with that name already exists.' : 'Failed to rename domain.');
    } else {
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, domain: trimmed } : d));
    }
    setSaving(null);
  }

  async function deleteDomain(domainId: string) {
    setSaving(domainId + 'delete');
    setError('');
    const { error: err } = await supabase
      .from('domain_owners')
      .delete()
      .eq('id', domainId);
    if (err) {
      setError('Failed to remove domain.');
    } else {
      setDomains(prev => prev.filter(d => d.id !== domainId));
    }
    setSaving(null);
  }

  async function addDomain() {
    const trimmed = newDomainName.trim();
    if (!trimmed) return;
    setAddingDomain(true);
    setError('');

    const categoryKey = DEFAULT_CATEGORY_MAP[trimmed] ?? 'other';
    const { data, error: err } = await supabase
      .from('domain_owners')
      .insert({
        workspace_id: workspaceId,
        domain: trimmed,
        category_key: categoryKey,
      })
      .select('id, domain, category_key, owner_user_id, backup_owner_user_id')
      .single();

    if (err) {
      setError(err.code === '23505' ? 'A domain with that name already exists.' : 'Failed to add domain.');
    } else if (data) {
      setDomains(prev => [...prev, data as DomainOwner].sort((a, b) => a.domain.localeCompare(b.domain)));
      setNewDomainName('');
    }
    setAddingDomain(false);
  }

  function memberLabel(userId: string | null): string {
    if (!userId) return 'Unassigned';
    const m = members.find(m => m.user_id === userId);
    return m?.profile?.full_name || m?.profile?.username || 'Unknown member';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--app-text-muted)' }} />
      </div>
    );
  }

  return (
    <section className="panel p-6 mb-4">
      <h2 className="section-label flex items-center gap-2 mb-1">
        <UserCog className="w-4 h-4" />
        Decision Ownership
      </h2>
      <p className="text-xs mb-4" style={{ color: 'var(--app-text-muted)' }}>
        Assign an owner and backup owner to each decision domain. Owners are shown on the Decision Map for visibility — they do not block or approve decisions.
      </p>

      {error && (
        <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--negative)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--negative)' }}>{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {domains.map(d => (
          <div key={d.id} className="p-3 rounded-lg" style={{ background: 'var(--app-border-subtle)' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <input
                type="text"
                value={d.domain}
                onChange={e => {
                  const val = e.target.value;
                  setDomains(prev => prev.map(x => x.id === d.id ? { ...x, domain: val } : x));
                }}
                onBlur={e => {
                  if (e.target.value.trim() && e.target.value.trim() !== d.domain) {
                    renameDomain(d.id, e.target.value);
                  }
                }}
                className="text-sm font-semibold flex-1 min-w-0 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5"
                style={{ color: 'var(--app-text-primary)' }}
              />
              <button
                onClick={() => deleteDomain(d.id)}
                disabled={saving === d.id + 'delete'}
                className="btn-ghost p-1.5 flex-shrink-0"
                style={{ color: 'var(--negative)' }}
                title="Remove domain"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--app-text-muted)' }}>Owner</label>
                <select
                  value={d.owner_user_id || ''}
                  onChange={e => updateOwner(d.id, 'owner_user_id', e.target.value || null)}
                  disabled={saving === d.id + 'owner_user_id'}
                  className="input-modern text-xs"
                  style={{ padding: '0.375rem 0.5rem' }}
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profile?.full_name || m.profile?.username || 'Member'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--app-text-muted)' }}>Backup</label>
                <select
                  value={d.backup_owner_user_id || ''}
                  onChange={e => updateOwner(d.id, 'backup_owner_user_id', e.target.value || null)}
                  disabled={saving === d.id + 'backup_owner_user_id'}
                  className="input-modern text-xs"
                  style={{ padding: '0.375rem 0.5rem' }}
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profile?.full_name || m.profile?.username || 'Member'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {saving && saving.startsWith(d.id) && (
              <div className="flex items-center gap-1.5 mt-2">
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--app-text-muted)' }} />
                <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>Saving…</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add domain */}
      <div className="flex items-center gap-2 mt-4">
        <input
          type="text"
          value={newDomainName}
          onChange={e => setNewDomainName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addDomain(); }}
          placeholder="Add new domain…"
          className="input-modern text-sm flex-1"
          style={{ padding: '0.5rem 0.75rem' }}
        />
        <button
          onClick={addDomain}
          disabled={addingDomain || !newDomainName.trim()}
          className="btn-secondary flex-shrink-0"
        >
          {addingDomain ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add
        </button>
      </div>
    </section>
  );
}
