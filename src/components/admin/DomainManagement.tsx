import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Globe, Mail, Shield, Plus, Trash2, CheckCircle, XCircle, Save, AlertTriangle, RefreshCw, AtSign, Copy } from 'lucide-react';

interface AllowedDomain {
  id: string;
  domain: string;
  type: 'registration' | 'admin' | 'both';
  is_active: boolean;
  notes: string;
  created_at: string;
}

interface AdminEmail {
  id: string;
  email: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

interface EmailConfig {
  id: string;
  key: string;
  value: string;
  description: string;
  updated_at: string;
}

interface EmailAccount {
  id: string;
  username: string;
  display_name: string;
  description: string;
  is_active: boolean;
  forward_to: string;
  created_at: string;
}

type Tab = 'domains' | 'admins' | 'email' | 'mailboxes';

export default function DomainManagement() {
  const [activeTab, setActiveTab] = useState<Tab>('domains');

  const [domains, setDomains] = useState<AllowedDomain[]>([]);
  const [adminEmails, setAdminEmails] = useState<AdminEmail[]>([]);
  const [emailConfig, setEmailConfig] = useState<EmailConfig[]>([]);

  const [loadingDomains, setLoadingDomains] = useState(true);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [newDomain, setNewDomain] = useState('');
  const [newDomainType, setNewDomainType] = useState<'registration' | 'admin' | 'both'>('registration');
  const [newDomainNotes, setNewDomainNotes] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminLabel, setNewAdminLabel] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);

  const [savingConfig, setSavingConfig] = useState(false);
  const [configEdits, setConfigEdits] = useState<Record<string, string>>({});

  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newForwardTo, setNewForwardTo] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadAll = () => {
    loadDomains();
    loadAdminEmails();
    loadEmailConfig();
    loadEmailAccounts();
  };

  const loadEmailAccounts = async () => {
    setLoadingAccounts(true);
    const { data, error } = await supabase
      .from('email_accounts')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) setEmailAccounts(data);
    setLoadingAccounts(false);
  };

  const handleAddAccount = async () => {
    const username = newUsername.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (!username) return;
    setAddingAccount(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('email_accounts').insert({
      username,
      display_name: newDisplayName.trim(),
      description: newDescription.trim(),
      forward_to: newForwardTo.trim().toLowerCase(),
      created_by: user?.id,
    });
    if (error) {
      showFeedback('error', error.message.includes('unique') ? 'This username is already taken.' : error.message);
    } else {
      setNewUsername('');
      setNewDisplayName('');
      setNewDescription('');
      setNewForwardTo('');
      showFeedback('success', `${username}@poddleme.com created.`);
      loadEmailAccounts();
    }
    setAddingAccount(false);
  };

  const handleToggleAccount = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('email_accounts')
      .update({ is_active: !currentState, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) showFeedback('error', error.message);
    else { showFeedback('success', `Account ${!currentState ? 'enabled' : 'disabled'}.`); loadEmailAccounts(); }
  };

  const handleDeleteAccount = async (id: string, username: string) => {
    if (!confirm(`Delete ${username}@poddleme.com? This cannot be undone.`)) return;
    const { error } = await supabase.from('email_accounts').delete().eq('id', id);
    if (error) showFeedback('error', error.message);
    else { showFeedback('success', `${username}@poddleme.com deleted.`); loadEmailAccounts(); }
  };

  const handleCopyEmail = (id: string, username: string) => {
    navigator.clipboard.writeText(`${username}@poddleme.com`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadDomains = async () => {
    setLoadingDomains(true);
    const { data, error } = await supabase
      .from('allowed_domains')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setDomains(data);
    setLoadingDomains(false);
  };

  const loadAdminEmails = async () => {
    setLoadingAdmins(true);
    const { data, error } = await supabase
      .from('admin_email_list')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) setAdminEmails(data);
    setLoadingAdmins(false);
  };

  const loadEmailConfig = async () => {
    setLoadingConfig(true);
    const { data, error } = await supabase
      .from('email_sending_config')
      .select('*')
      .order('key', { ascending: true });
    if (!error && data) {
      setEmailConfig(data);
      const edits: Record<string, string> = {};
      data.forEach((c) => { edits[c.key] = c.value; });
      setConfigEdits(edits);
    }
    setLoadingConfig(false);
  };

  const handleAddDomain = async () => {
    const trimmed = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!trimmed) return;
    setAddingDomain(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('allowed_domains').insert({
      domain: trimmed,
      type: newDomainType,
      notes: newDomainNotes.trim(),
      created_by: user?.id,
    });
    if (error) {
      showFeedback('error', error.message.includes('unique') ? 'Domain already exists.' : error.message);
    } else {
      setNewDomain('');
      setNewDomainNotes('');
      setNewDomainType('registration');
      showFeedback('success', `Domain "${trimmed}" added.`);
      loadDomains();
    }
    setAddingDomain(false);
  };

  const handleToggleDomain = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('allowed_domains')
      .update({ is_active: !currentState, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) showFeedback('error', error.message);
    else {
      showFeedback('success', `Domain ${!currentState ? 'enabled' : 'disabled'}.`);
      loadDomains();
    }
  };

  const handleDeleteDomain = async (id: string, domain: string) => {
    if (!confirm(`Remove domain "${domain}"?`)) return;
    const { error } = await supabase.from('allowed_domains').delete().eq('id', id);
    if (error) showFeedback('error', error.message);
    else { showFeedback('success', `Domain "${domain}" removed.`); loadDomains(); }
  };

  const handleAddAdminEmail = async () => {
    const trimmed = newAdminEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;
    setAddingAdmin(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('admin_email_list').insert({
      email: trimmed,
      label: newAdminLabel.trim(),
      created_by: user?.id,
    });
    if (error) {
      showFeedback('error', error.message.includes('unique') ? 'Email already in list.' : error.message);
    } else {
      setNewAdminEmail('');
      setNewAdminLabel('');
      showFeedback('success', `Admin email "${trimmed}" added.`);
      loadAdminEmails();
    }
    setAddingAdmin(false);
  };

  const handleToggleAdminEmail = async (id: string, currentState: boolean) => {
    const { error } = await supabase.from('admin_email_list').update({ is_active: !currentState }).eq('id', id);
    if (error) showFeedback('error', error.message);
    else { showFeedback('success', `Email ${!currentState ? 'enabled' : 'disabled'}.`); loadAdminEmails(); }
  };

  const handleDeleteAdminEmail = async (id: string, email: string) => {
    if (!confirm(`Remove "${email}" from admin list?`)) return;
    const { error } = await supabase.from('admin_email_list').delete().eq('id', id);
    if (error) showFeedback('error', error.message);
    else { showFeedback('success', `"${email}" removed.`); loadAdminEmails(); }
  };

  const handleSaveEmailConfig = async () => {
    setSavingConfig(true);
    const { data: { user } } = await supabase.auth.getUser();
    const updates = Object.entries(configEdits).map(([key, value]) =>
      supabase.from('email_sending_config').update({
        value,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }).eq('key', key)
    );
    const results = await Promise.all(updates);
    const anyError = results.find(r => r.error);
    if (anyError?.error) showFeedback('error', anyError.error.message);
    else { showFeedback('success', 'Email configuration saved.'); loadEmailConfig(); }
    setSavingConfig(false);
  };

  const typeLabel = (type: string) => {
    if (type === 'registration') return { label: 'Registration', color: 'bg-blue-100 text-blue-700' };
    if (type === 'admin') return { label: 'Admin Only', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Both', color: 'bg-green-100 text-green-700' };
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'domains', label: 'Email Domains', icon: <Globe className="w-4 h-4" /> },
    { id: 'admins', label: 'Admin Emails', icon: <Shield className="w-4 h-4" /> },
    { id: 'email', label: 'Email Settings', icon: <Mail className="w-4 h-4" /> },
    { id: 'mailboxes', label: 'Mailboxes', icon: <AtSign className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Domain Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Control allowed domains, admin access, and email configuration</p>
        </div>
        <button onClick={loadAll} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
          feedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="flex border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'domains' && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <strong>Note:</strong> This whitelist is informational only unless your registration flow explicitly checks it. Use it to document and track approved domains.
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Add Domain</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                placeholder="example.com"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <select
                value={newDomainType}
                onChange={(e) => setNewDomainType(e.target.value as typeof newDomainType)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="registration">Registration</option>
                <option value="admin">Admin Only</option>
                <option value="both">Both</option>
              </select>
              <input
                value={newDomainNotes}
                onChange={(e) => setNewDomainNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <button
              onClick={handleAddDomain}
              disabled={addingDomain || !newDomain.trim()}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {addingDomain ? 'Adding...' : 'Add Domain'}
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {loadingDomains ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading domains...</div>
            ) : domains.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No domains added yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Domain</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Notes</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {domains.map((d) => {
                    const t = typeLabel(d.type);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-800">{d.domain}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>{t.label}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{d.notes || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${d.is_active ? 'text-green-700' : 'text-slate-400'}`}>
                            {d.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {d.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleToggleDomain(d.id, d.is_active)}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                d.is_active
                                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {d.is_active ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleDeleteDomain(d.id, d.domain)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'admins' && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>Admin Emails:</strong> Users on this list can access the verification management panel at <code className="bg-blue-100 px-1 rounded">#admin</code>. Only active entries are checked.
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Add Admin Email</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAdminEmail()}
                placeholder="admin@example.com"
                type="email"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
              <input
                value={newAdminLabel}
                onChange={(e) => setNewAdminLabel(e.target.value)}
                placeholder="Label (e.g. Primary Admin)"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <button
              onClick={handleAddAdminEmail}
              disabled={addingAdmin || !newAdminEmail.trim()}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {addingAdmin ? 'Adding...' : 'Add Email'}
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {loadingAdmins ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading admin emails...</div>
            ) : adminEmails.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No admin emails configured.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Label</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminEmails.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-800">{a.email}</td>
                      <td className="px-4 py-3 text-slate-500">{a.label || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${a.is_active ? 'text-green-700' : 'text-slate-400'}`}>
                          {a.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {a.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleAdminEmail(a.id, a.is_active)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              a.is_active
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {a.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleDeleteAdminEmail(a.id, a.email)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-semibold text-slate-800 mb-1">Email Sending Configuration</h3>
            <p className="text-sm text-slate-500 mb-5">These values are used by edge functions when sending emails to users.</p>

            {loadingConfig ? (
              <div className="text-center text-slate-500 text-sm py-6">Loading configuration...</div>
            ) : (
              <div className="space-y-4">
                {emailConfig.map((c) => (
                  <div key={c.key} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-700 font-mono">{c.key}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        value={configEdits[c.key] ?? c.value}
                        onChange={(e) => setConfigEdits(prev => ({ ...prev, [c.key]: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        placeholder={`Enter ${c.key}`}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-slate-100">
                  <button
                    onClick={handleSaveEmailConfig}
                    disabled={savingConfig}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {savingConfig ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'mailboxes' && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>poddleme.com Mailboxes:</strong> Create and manage <code className="bg-blue-100 px-1 rounded">@poddleme.com</code> email accounts. Set a forwarding address to receive mail in an existing inbox.
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Create Mailbox</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Username <span className="text-red-500">*</span></label>
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                  <input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
                    placeholder="hello"
                    className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
                  />
                  <span className="px-3 py-2 text-sm text-slate-400 bg-slate-50 border-l border-slate-300 whitespace-nowrap">@poddleme.com</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Display Name</label>
                <input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Poddle Support"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Forward To</label>
                <input
                  value={newForwardTo}
                  onChange={(e) => setNewForwardTo(e.target.value)}
                  placeholder="your@gmail.com"
                  type="email"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Description</label>
                <input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Purpose of this mailbox"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleAddAccount}
              disabled={addingAccount || !newUsername.trim()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {addingAccount ? 'Creating...' : 'Create Mailbox'}
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {loadingAccounts ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading mailboxes...</div>
            ) : emailAccounts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AtSign className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm font-medium">No mailboxes yet</p>
                <p className="text-slate-400 text-xs mt-1">Create your first @poddleme.com address above</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Email Address</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Display Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Forwards To</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {emailAccounts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-800 text-sm">{a.username}@poddleme.com</span>
                          <button
                            onClick={() => handleCopyEmail(a.id, a.username)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors flex-shrink-0"
                            title="Copy email address"
                          >
                            {copiedId === a.id ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {a.description && <p className="text-xs text-slate-400 mt-0.5">{a.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{a.display_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden md:table-cell">{a.forward_to || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${a.is_active ? 'text-green-700' : 'text-slate-400'}`}>
                          {a.is_active ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {a.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleAccount(a.id, a.is_active)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              a.is_active
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {a.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(a.id, a.username)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
