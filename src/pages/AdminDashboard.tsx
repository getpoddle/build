import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sentry } from '../lib/sentry';
import { Shield, Users, CheckCircle, XCircle, Search, LogOut, Key, Eye, TrendingUp, Ban, AlertTriangle, Clock, UserCheck, Trash2, Download, Globe, RefreshCw, ChevronDown, BookOpen, Database } from 'lucide-react';
import { getAvatarUrl } from '../lib/avatarUtils';
import DomainManagement from '../components/admin/DomainManagement';
import BlogAdmin from '../components/admin/BlogAdmin';

type AdminView = 'users' | 'domains' | 'workspaces' | 'upgrades' | 'blog' | 'dataset';

interface UpgradeRequest {
  id: string;
  requested_plan: string;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
    username: string | null;
    avatar_url: string | null;
    subscription_tier: string;
  } | null;
}

interface UserStats {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  verified: boolean;
  created_at: string;
  workspaces_created: number;
  workspaces_opened: number;
  workspaces_created_alltime: number;
  pdfs_exported: number;
  account_status?: string;
  reason?: string;
  suspended_until?: string;
}

interface ModerationAction {
  userId: string;
  action: 'suspend' | 'ban' | 'unsuspend' | 'delete';
  reason: string;
  duration?: number;
  notes?: string;
}

export default function AdminDashboard() {
  const [adminView, setAdminView] = useState<AdminView>('users');
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationAction, setModerationAction] = useState<ModerationAction | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationDuration, setModerationDuration] = useState<number>(7);
  const [moderationNotes, setModerationNotes] = useState('');
  const [processingModeration, setProcessingModeration] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'banned'>('all');
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const [userWorkspaces, setUserWorkspaces] = useState<any[]>([]);
  const [loadingContributions, setLoadingContributions] = useState(false);
  const [adminWorkspaces, setAdminWorkspaces] = useState<any[]>([]);
  const [loadingAdminWorkspaces, setLoadingAdminWorkspaces] = useState(false);
  const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequest[]>([]);
  const [loadingUpgrades, setLoadingUpgrades] = useState(false);
  const [upgradeFilter, setUpgradeFilter] = useState<'pending' | 'all' | 'approved' | 'rejected'>('pending');
  const [processingUpgrade, setProcessingUpgrade] = useState<string | null>(null);
  const [upgradeAdminNote, setUpgradeAdminNote] = useState<Record<string, string>>({});
  const [datasetStats, setDatasetStats] = useState<any>(null);
  const [datasetPairs, setDatasetPairs] = useState<any[]>([]);
  const [loadingDataset, setLoadingDataset] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadDataset = async () => {
    setLoadingDataset(true);
    try {
      const [statsRes, pairsRes] = await Promise.all([
        supabase.rpc('get_training_dataset_stats'),
        supabase
          .from('synthesis_training_pairs')
          .select('*')
          .order('quality_score', { ascending: false })
          .limit(50),
      ]);
      if (statsRes.error) throw statsRes.error;
      if (pairsRes.error) throw pairsRes.error;
      setDatasetStats(statsRes.data);
      setDatasetPairs(pairsRes.data || []);
    } catch (e: any) {
      console.error('Error loading dataset:', e);
      Sentry.captureException(e);
      alert(e.message || 'Failed to load dataset.');
    } finally {
      setLoadingDataset(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Step 1: fetch base user list using only publicly-granted columns.
      const { data: baseRows, error: baseError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, verified, created_at, onboarded, referral_tier, referral_points')
        .order('created_at', { ascending: false })
        .limit(2000);

      if (baseError) throw baseError;
      if (!baseRows || baseRows.length === 0) {
        setUsers([]);
        return;
      }

      // Step 2: batch-fetch sensitive columns via admin-only RPC.
      const userIds = baseRows.map(r => r.id);
      const { data: sensitiveRows, error: sensitiveError } = await supabase
        .rpc('get_profiles_sensitive_admin', { target_user_ids: userIds });

      if (sensitiveError) throw sensitiveError;

      // Step 3: fetch workspace usage stats via the existing admin RPC.
      const { data: statsRows, error: statsError } = await supabase.rpc('get_admin_all_users');

      if (statsError) throw statsError;

      // Step 4: merge all three sources by id.
      const sensitiveMap = new Map<string, any>();
      (sensitiveRows || []).forEach((r: any) => sensitiveMap.set(r.id, r));
      const statsMap = new Map<string, any>();
      (statsRows || []).forEach((r: any) => statsMap.set(r.id, r));

      const merged: UserStats[] = baseRows.map(r => {
        const s = sensitiveMap.get(r.id) || {};
        const st = statsMap.get(r.id) || {};
        return {
          id: r.id,
          full_name: r.full_name,
          email: s.email || '',
          username: r.username,
          avatar_url: r.avatar_url,
          verified: r.verified,
          created_at: r.created_at,
          workspaces_created: st.workspaces_created ?? 0,
          workspaces_opened: st.workspaces_opened ?? 0,
          workspaces_created_alltime: st.workspaces_created_alltime ?? 0,
          pdfs_exported: st.pdfs_exported ?? 0,
          account_status: st.account_status ?? 'active',
          reason: st.reason,
          suspended_until: st.suspended_until,
        };
      });

      setUsers(merged);
    } catch (error: any) {
      console.error('Error loading users:', error);
      Sentry.captureException(error);
      setLoadError(error.message || 'Failed to load users. Check browser console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/admin';
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      setChangingPassword(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      alert('Password changed successfully');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      alert(error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const openModerationModal = (userId: string, userName: string, action: 'suspend' | 'ban' | 'unsuspend' | 'delete') => {
    setModerationAction({ userId, action, reason: '' });
    setModerationReason('');
    setModerationDuration(7);
    setModerationNotes('');
    setShowModerationModal(true);
  };

  const handleModerationAction = async () => {
    if (!moderationAction) return;

    if (!moderationReason.trim()) {
      alert('Please provide a reason for this action');
      return;
    }

    if (moderationAction.action === 'delete') {
      const confirmDelete = window.confirm(
        'Are you absolutely sure you want to DELETE this user? This action is PERMANENT and will remove all their data from the system. This cannot be undone!'
      );
      if (!confirmDelete) return;
    }

    try {
      setProcessingModeration(true);

      let result;
      if (moderationAction.action === 'suspend') {
        result = await supabase.rpc('suspend_user_account', {
          target_user_id: moderationAction.userId,
          reason_param: moderationReason,
          duration_days: moderationDuration,
          notes_param: moderationNotes || null,
        });
      } else if (moderationAction.action === 'ban') {
        result = await supabase.rpc('ban_user_account', {
          target_user_id: moderationAction.userId,
          reason_param: moderationReason,
          notes_param: moderationNotes || null,
        });
      } else if (moderationAction.action === 'unsuspend') {
        result = await supabase.rpc('unsuspend_user_account', {
          target_user_id: moderationAction.userId,
          reason_param: moderationReason,
        });
      } else if (moderationAction.action === 'delete') {
        // The edge function deletes all public-schema data AND removes the auth.users
        // record in one atomic sequence, ensuring the email is free to re-register.
        const { data: { session } } = await supabase.auth.getSession();
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const authDeleteRes = await fetch(`${supabaseUrl}/functions/v1/admin-delete-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ target_user_id: moderationAction.userId }),
        });
        const authDeleteJson = await authDeleteRes.json();
        if (!authDeleteRes.ok) {
          throw new Error(authDeleteJson.error ?? 'Failed to delete user');
        }
      }

      if (result?.error) throw result.error;

      let successMessage = 'User updated successfully';
      if (moderationAction.action === 'delete') successMessage = 'User permanently deleted';
      else if (moderationAction.action === 'unsuspend') successMessage = 'User unsuspended';
      else if (moderationAction.action === 'suspend') successMessage = 'User suspended';
      else if (moderationAction.action === 'ban') successMessage = 'User banned';

      alert(successMessage);
      setShowModerationModal(false);
      setModerationAction(null);
      loadUsers();
    } catch (error: any) {
      console.error('Error processing moderation action:', error);
      alert(error.message || 'Failed to process moderation action');
    } finally {
      setProcessingModeration(false);
    }
  };

  const viewUserDetails = async (user: UserStats) => {
    setSelectedUser(user);
    setShowUserDetailModal(true);
    setUserWorkspaces([]);
    setLoadingContributions(true);

    try {
      const { data, error } = await supabase.rpc('get_admin_user_workspaces', { target_user_id: user.id });
      if (error) throw error;
      setUserWorkspaces(data || []);
    } catch (err: any) {
      console.error('Error loading user workspaces:', err);
      Sentry.captureException(err);
      alert(err.message || 'Failed to load user workspaces.');
    } finally {
      setLoadingContributions(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || user.account_status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const exportToCSV = () => {
    const headers = [
      'Full Name',
      'Email',
      'Status',
      'Verified',
      'Workspaces Created (Now)',
      'Workspaces Opened (Now)',
      'Workspaces Created (All Time)',
      'PDFs Exported',
      'Joined Date',
    ];

    const rows = filteredUsers.map(user => [
      user.full_name || '',
      user.email || '',
      user.account_status || 'active',
      user.verified ? 'Yes' : 'No',
      user.workspaces_created ?? 0,
      user.workspaces_opened ?? 0,
      user.workspaces_created_alltime ?? 0,
      user.pdfs_exported ?? 0,
      new Date(user.created_at).toLocaleDateString(),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `poddle-users-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadAdminWorkspaces = async () => {
    setLoadingAdminWorkspaces(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_all_workspaces');
      if (error) throw error;
      setAdminWorkspaces(data || []);
    } catch (err: any) {
      console.error('Error loading workspaces:', err);
      Sentry.captureException(err);
      alert(err.message || 'Failed to load workspaces.');
    } finally {
      setLoadingAdminWorkspaces(false);
    }
  };

  const loadUpgradeRequests = async (filter = upgradeFilter) => {
    setLoadingUpgrades(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-upgrade-requests?status=${filter}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setUpgradeRequests(json.requests || []);
    } catch (e: any) {
      console.error('Error loading upgrade requests:', e);
      Sentry.captureException(e);
      alert(e.message || 'Failed to load upgrade requests.');
    } finally {
      setLoadingUpgrades(false);
    }
  };

  const handleUpgradeAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingUpgrade(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-upgrade-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request_id: requestId, action, admin_notes: upgradeAdminNote[requestId] || '' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) loadUpgradeRequests(upgradeFilter);
    } catch (e: any) {
      console.error('Error processing upgrade action:', e);
      Sentry.captureException(e);
      alert(e.message || 'Failed to process upgrade action.');
    } finally {
      setProcessingUpgrade(null);
    }
  };

  const totalUsers = users.length;
  const suspendedUsers = users.filter(u => u.account_status === 'suspended').length;
  const bannedUsers = users.filter(u => u.account_status === 'banned').length;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-600">User Management</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setAdminView('users')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    adminView === 'users'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Users
                </button>
                <button
                  onClick={() => setAdminView('domains')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
                    adminView === 'domains'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Domains
                </button>
                <button
                  onClick={() => { setAdminView('workspaces'); loadAdminWorkspaces(); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
                    adminView === 'workspaces'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Workspaces
                </button>
                <button
                  onClick={() => { setAdminView('upgrades'); loadUpgradeRequests('pending'); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
                    adminView === 'upgrades'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Upgrades
                  {upgradeRequests.filter(r => r.status === 'pending').length > 0 && adminView !== 'upgrades' && (
                    <span className="ml-1 bg-amber-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {upgradeRequests.filter(r => r.status === 'pending').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setAdminView('blog')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
                    adminView === 'blog'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Blog
                </button>
                <button
                  onClick={() => { setAdminView('dataset'); loadDataset(); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
                    adminView === 'dataset'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  Dataset
                </button>
              </div>
              {adminView === 'users' && (
                <button
                  onClick={exportToCSV}
                  disabled={filteredUsers.length === 0}
                  className="px-4 py-2 border border-green-300 text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                  {filteredUsers.length > 0 && (
                    <span className="ml-1 bg-green-200 text-green-800 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                      {filteredUsers.length}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                Change Password
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {adminView === 'domains' && (
          <DomainManagement />
        )}

        {adminView === 'workspaces' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                Private Workspaces
              </h3>
              {loadingAdminWorkspaces ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : adminWorkspaces.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No workspaces yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Workspace</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Topic</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Seats</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminWorkspaces.map((ws: any) => (
                          <tr key={ws.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-medium text-slate-900">{ws.name}</td>
                            <td className="py-2.5 px-3 max-w-[200px]">
                              {ws.description ? (
                                <span className="text-xs text-slate-700 line-clamp-2 leading-relaxed" title={ws.description}>{ws.description}</span>
                              ) : (
                                <span className="text-xs text-slate-300 italic">No topic</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{ws.owner_full_name || ws.owner_email || '—'}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>
                                {ws.plan}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-xs font-medium capitalize ${ws.subscription_status === 'active' ? 'text-green-600' : ws.subscription_status === 'cancelled' ? 'text-red-500' : 'text-amber-600'}`}>
                                {ws.subscription_status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{ws.seats}</td>
                            <td className="py-2.5 px-3 text-slate-400">{new Date(ws.created_at).toLocaleDateString()}</td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {adminView === 'upgrades' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Upgrade Requests</h3>
                    <p className="text-sm text-slate-500">Users requesting Pro or Enterprise access</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={upgradeFilter}
                      onChange={e => {
                        const f = e.target.value as typeof upgradeFilter;
                        setUpgradeFilter(f);
                        loadUpgradeRequests(f);
                      }}
                      className="pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="all">All</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  <button
                    onClick={() => loadUpgradeRequests(upgradeFilter)}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {loadingUpgrades ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : upgradeRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No {upgradeFilter === 'all' ? '' : upgradeFilter} upgrade requests.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upgradeRequests.map(req => {
                    const profile = Array.isArray(req.profiles) ? req.profiles[0] : req.profiles;
                    const isPending = req.status === 'pending';
                    return (
                      <div key={req.id} className="rounded-xl p-4" style={{ border: '1px solid rgba(15,23,42,0.08)', background: isPending ? 'rgba(245,158,11,0.03)' : '#fafafa' }}>
                        <div className="flex items-start gap-4">
                          <img
                            src={getAvatarUrl(profile?.avatar_url || null, profile?.full_name || 'U')}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-slate-900 text-sm">{profile?.full_name || 'User'}</span>
                              {profile?.username && <span className="text-xs text-slate-400">@{profile.username}</span>}
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold capitalize"
                                style={{
                                  background: req.status === 'pending' ? 'rgba(245,158,11,0.12)' : req.status === 'approved' ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.08)',
                                  color: req.status === 'pending' ? '#b45309' : req.status === 'approved' ? '#15803d' : '#dc2626',
                                }}
                              >
                                {req.status}
                              </span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}>
                                → {req.requested_plan}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mb-1">
                              Current tier: <strong className="text-slate-600 capitalize">{profile?.subscription_tier || 'free'}</strong>
                              {' · '}{new Date(req.created_at).toLocaleDateString()}
                            </p>
                            {req.notes && (
                              <p className="text-sm text-slate-600 mb-2 leading-relaxed italic">"{req.notes}"</p>
                            )}
                            {req.admin_notes && (
                              <p className="text-xs text-slate-400">Admin note: {req.admin_notes}</p>
                            )}
                            {isPending && (
                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <input
                                  type="text"
                                  placeholder="Admin note (optional)"
                                  value={upgradeAdminNote[req.id] || ''}
                                  onChange={e => setUpgradeAdminNote(n => ({ ...n, [req.id]: e.target.value }))}
                                  className="flex-1 min-w-32 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  onClick={() => handleUpgradeAction(req.id, 'approve')}
                                  disabled={processingUpgrade === req.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                                  style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}
                                >
                                  {processingUpgrade === req.id ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleUpgradeAction(req.id, 'reject')}
                                  disabled={processingUpgrade === req.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {adminView === 'users' && <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Total Users</p>
                <p className="text-2xl font-bold text-slate-900">{totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm text-slate-600">Suspended</p>
                <p className="text-2xl font-bold text-slate-900">{suspendedUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Ban className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-slate-600">Banned</p>
                <p className="text-2xl font-bold text-slate-900">{bannedUsers}</p>
              </div>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Failed to load user data</p>
                <p className="text-sm text-red-700 mt-1">{loadError}</p>
                <button
                  onClick={() => loadUsers()}
                  className="mt-2 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {users.length === 2000 && (
          <div className="mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            Showing the 2,000 most recent users. Use search to find specific users beyond this limit.
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-4 border-b border-slate-200 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name or email..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Filter by status:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus('active')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'active'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilterStatus('suspended')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'suspended'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Suspended
                </button>
                <button
                  onClick={() => setFilterStatus('banned')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'banned'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Banned
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 mb-2">No users found.</p>
                <p className="text-sm text-slate-400">Check browser console (F12) for error details.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Workspace Usage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((user) => {
                    return (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {user.avatar_url ? (
                              <img
                                src={getAvatarUrl(user.avatar_url) || ''}
                                alt={user.full_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center">
                                <span className="text-white font-semibold">
                                  {user.full_name?.charAt(0) || '?'}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-900">{user.full_name}</p>
                              </div>
                              <p className="text-sm text-slate-600">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            {user.account_status === 'active' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                <UserCheck className="w-3 h-3 mr-1" />
                                Active
                              </span>
                            )}
                            {user.account_status === 'suspended' && (
                              <div>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Suspended
                                </span>
                                {user.reason && (
                                  <p className="text-xs text-slate-500 mt-1">{user.reason}</p>
                                )}
                                {user.suspended_until && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Until {new Date(user.suspended_until).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )}
                            {user.account_status === 'banned' && (
                              <div>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                  <Ban className="w-3 h-3 mr-1" />
                                  Banned
                                </span>
                                {user.reason && (
                                  <p className="text-xs text-slate-500 mt-1">{user.reason}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-36 text-xs">Owned (now)</span>
                              <span className="font-semibold text-slate-900">{user.workspaces_created ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-36 text-xs">Member of (now)</span>
                              <span className="font-semibold text-slate-900">{user.workspaces_opened ?? 0}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-36 text-xs">Created (all time)</span>
                              <span className={`font-semibold ${(user.workspaces_created_alltime ?? 0) > (user.workspaces_created ?? 0) ? 'text-amber-700' : 'text-slate-900'}`}>
                                {user.workspaces_created_alltime ?? 0}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-36 text-xs">PDFs Exported</span>
                              <span className="font-semibold text-slate-900">{user.pdfs_exported ?? 0}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => viewUserDetails(user)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                            >
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                View Details
                              </span>
                            </button>

                            {user.account_status === 'active' && (
                              <>
                                <button
                                  onClick={() => openModerationModal(user.id, user.full_name, 'suspend')}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                                >
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Suspend
                                  </span>
                                </button>
                                <button
                                  onClick={() => openModerationModal(user.id, user.full_name, 'ban')}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                                >
                                  <span className="flex items-center gap-1">
                                    <Ban className="w-3 h-3" />
                                    Ban
                                  </span>
                                </button>
                              </>
                            )}

                            {(user.account_status === 'suspended' || user.account_status === 'banned') && (
                              <button
                                onClick={() => openModerationModal(user.id, user.full_name, 'unsuspend')}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                              >
                                <span className="flex items-center gap-1">
                                  <UserCheck className="w-3 h-3" />
                                  Restore
                                </span>
                              </button>
                            )}

                            <button
                              onClick={() => openModerationModal(user.id, user.full_name, 'delete')}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-white hover:bg-slate-900 transition-colors"
                            >
                              <span className="flex items-center gap-1">
                                <Trash2 className="w-3 h-3" />
                                Delete User
                              </span>
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
        </div>}

        {adminView === 'blog' && <BlogAdmin />}

        {adminView === 'dataset' && (
          <div className="space-y-4">
            {/* Stats cards */}
            {loadingDataset ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">Loading dataset…</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total pairs', value: datasetStats?.total_pairs ?? 0, color: '#2563eb' },
                    { label: 'High quality (≥70)', value: datasetStats?.high_quality_pairs ?? 0, color: '#16a34a' },
                    { label: 'Pairs with outcomes', value: datasetStats?.pairs_with_outcomes ?? 0, color: '#7c3aed' },
                    { label: 'Total outcomes', value: datasetStats?.total_outcomes ?? 0, color: '#d97706' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
                      <p className="text-xs text-slate-500 mb-1">{label}</p>
                      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {datasetStats?.avg_health_score != null && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-6 text-sm">
                    <span className="text-slate-500">Avg health score: <strong className="text-slate-800">{datasetStats.avg_health_score}</strong></span>
                    {datasetStats.avg_success_rate != null && (
                      <span className="text-slate-500">Avg success rate: <strong className="text-slate-800">{datasetStats.avg_success_rate}%</strong></span>
                    )}
                    {datasetStats.category_breakdown && (
                      <span className="text-slate-500">
                        Categories:{' '}
                        {Object.entries(datasetStats.category_breakdown as Record<string, number>)
                          .sort((a, b) => b[1] - a[1])
                          .map(([cat, cnt]) => (
                            <span key={cat} className="inline-flex items-center gap-1 ml-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              {cat} {cnt}
                            </span>
                          ))}
                      </span>
                    )}
                  </div>
                )}

                {/* Pairs table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Training Pairs (top 50 by quality)</h3>
                    <button onClick={loadDataset} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-semibold">
                          <th className="text-left px-4 py-2.5">Category</th>
                          <th className="text-right px-4 py-2.5">Health</th>
                          <th className="text-left px-4 py-2.5">Style</th>
                          <th className="text-right px-4 py-2.5">Risks</th>
                          <th className="text-right px-4 py-2.5">Actions</th>
                          <th className="text-right px-4 py-2.5">Outcomes</th>
                          <th className="text-right px-4 py-2.5">Success%</th>
                          <th className="text-right px-4 py-2.5">Quality</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {datasetPairs.map(pair => (
                          <tr key={pair.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium capitalize text-slate-700">{pair.decision_category}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="font-bold" style={{ color: pair.decision_health_score >= 70 ? '#16a34a' : pair.decision_health_score >= 50 ? '#d97706' : '#dc2626' }}>
                                {pair.decision_health_score}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 max-w-[140px] truncate">{pair.decision_style ?? '—'}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{pair.risk_signal_count}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{pair.action_item_count}</td>
                            <td className="px-4 py-2.5 text-right text-slate-600">{pair.outcomes_recorded}</td>
                            <td className="px-4 py-2.5 text-right">
                              {pair.success_rate != null
                                ? <span style={{ color: pair.success_rate >= 60 ? '#16a34a' : pair.success_rate >= 40 ? '#d97706' : '#dc2626' }}>{pair.success_rate}%</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="px-2 py-0.5 rounded-full font-bold text-[10px]" style={{
                                background: pair.quality_score >= 70 ? 'rgba(22,163,74,0.1)' : pair.quality_score >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(15,23,42,0.06)',
                                color: pair.quality_score >= 70 ? '#15803d' : pair.quality_score >= 50 ? '#b45309' : '#64748b',
                              }}>{pair.quality_score}</span>
                            </td>
                          </tr>
                        ))}
                        {datasetPairs.length === 0 && (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No training pairs yet. Run War Room synthesis to populate.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Change Password</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedUser.avatar_url ? (
                    <img
                      src={getAvatarUrl(selectedUser.avatar_url) || ''}
                      alt={selectedUser.full_name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center">
                      <span className="text-white font-semibold text-xl">
                        {selectedUser.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-slate-900">{selectedUser.full_name}</h2>
                    </div>
                    <p className="text-slate-600">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowUserDetailModal(false);
                    setSelectedUser(null);
                    setUserWorkspaces([]);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Workspace usage summary cards */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{selectedUser.workspaces_created ?? 0}</p>
                  <p className="text-xs font-semibold text-blue-500 mt-1 uppercase tracking-wide">Owned Now</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-slate-700">{selectedUser.workspaces_opened ?? 0}</p>
                  <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide">Member Of Now</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={`border rounded-xl p-4 text-center ${(selectedUser.workspaces_created_alltime ?? 0) > (selectedUser.workspaces_created ?? 0) ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-2xl font-bold ${(selectedUser.workspaces_created_alltime ?? 0) > (selectedUser.workspaces_created ?? 0) ? 'text-amber-700' : 'text-slate-700'}`}>
                    {selectedUser.workspaces_created_alltime ?? 0}
                  </p>
                  <p className={`text-xs font-semibold mt-1 uppercase tracking-wide ${(selectedUser.workspaces_created_alltime ?? 0) > (selectedUser.workspaces_created ?? 0) ? 'text-amber-600' : 'text-slate-500'}`}>
                    Created All Time
                    {(selectedUser.workspaces_created_alltime ?? 0) > (selectedUser.workspaces_created ?? 0) && (
                      <span className="block normal-case font-normal mt-0.5 text-amber-500">
                        {(selectedUser.workspaces_created_alltime ?? 0) - (selectedUser.workspaces_created ?? 0)} deleted
                      </span>
                    )}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{selectedUser.pdfs_exported ?? 0}</p>
                  <p className="text-xs font-semibold text-green-500 mt-1 uppercase tracking-wide">PDFs Exported</p>
                </div>
              </div>

              {/* Workspace memberships */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">Workspace Memberships ({userWorkspaces.length})</h3>
                </div>
                {loadingContributions ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : userWorkspaces.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">No workspace memberships yet.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {userWorkspaces.map((m: any, i: number) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm">{m.workspace_name ?? 'Unknown'}</p>
                          {m.workspace_description && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate" title={m.workspace_description}>
                              <span className="font-semibold text-slate-600">Topic:</span> {m.workspace_description}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">
                            Role: <span className="font-semibold capitalize">{m.role}</span>
                            {m.workspace_plan && <> &middot; Plan: <span className="font-semibold capitalize">{m.workspace_plan}</span></>}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            m.workspace_status === 'active' ? 'bg-green-100 text-green-700' :
                            m.workspace_status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {m.workspace_status ?? 'unknown'}
                          </span>
                          <p className="text-xs text-slate-400 mt-1">
                            {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showModerationModal && moderationAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {moderationAction.action === 'suspend' && 'Suspend User Account'}
              {moderationAction.action === 'ban' && 'Ban User Account'}
              {moderationAction.action === 'unsuspend' && 'Restore User Account'}
              {moderationAction.action === 'delete' && 'Delete User Account'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Provide a clear reason for this action..."
                />
              </div>

              {moderationAction.action === 'suspend' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Duration (days)
                  </label>
                  <select
                    value={moderationDuration}
                    onChange={(e) => setModerationDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
              )}

              {moderationAction.action !== 'delete' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={moderationNotes}
                    onChange={(e) => setModerationNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                    placeholder="Optional internal notes..."
                  />
                </div>
              )}

              {moderationAction.action === 'ban' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Warning:</strong> Banning a user is a permanent action. The user will not be able to access their account or create new content.
                  </p>
                </div>
              )}

              {moderationAction.action === 'delete' && (
                <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
                  <p className="text-sm text-white mb-2">
                    <strong>DANGER:</strong> This will PERMANENTLY DELETE the user and ALL their data including:
                  </p>
                  <ul className="text-xs text-slate-300 space-y-1 ml-4 list-disc">
                    <li>Profile information</li>
                    <li>All assumptions, challenges, forecasts, risks, and scenarios</li>
                    <li>All decision room memberships and contributions</li>
                    <li>Authentication credentials</li>
                  </ul>
                  <p className="text-sm text-red-400 mt-3 font-semibold">
                    This action CANNOT be undone!
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleModerationAction}
                  disabled={processingModeration}
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                    moderationAction.action === 'suspend'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : moderationAction.action === 'ban'
                      ? 'bg-red-600 hover:bg-red-700'
                      : moderationAction.action === 'delete'
                      ? 'bg-slate-900 hover:bg-black'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {processingModeration ? 'Processing...' :
                    moderationAction.action === 'suspend' ? 'Suspend User' :
                    moderationAction.action === 'ban' ? 'Ban User' :
                    moderationAction.action === 'delete' ? 'Delete User Permanently' :
                    'Restore Account'
                  }
                </button>
                <button
                  onClick={() => {
                    setShowModerationModal(false);
                    setModerationAction(null);
                    setModerationReason('');
                    setModerationNotes('');
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
