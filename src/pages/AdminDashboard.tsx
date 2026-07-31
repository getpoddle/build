import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Users, CheckCircle, XCircle, Search, LogOut, Key, Eye, TrendingUp, Ban, AlertTriangle, Clock, UserCheck, Trash2, UserPlus, Download, Globe, Bot, Play, RefreshCw, Sparkles, ChevronDown, BookOpen, Database } from 'lucide-react';
import { getAvatarUrl } from '../lib/avatarUtils';
import VerificationBadge from '../components/VerificationBadge';
import DomainManagement from '../components/admin/DomainManagement';
import BlogAdmin from '../components/admin/BlogAdmin';

type AdminView = 'users' | 'domains' | 'ai-discussions' | 'workspaces' | 'upgrades' | 'blog' | 'dataset' | 'beta-codes';

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
  pods_joined_count: number;
  account_status?: string;
  reason?: string;
  suspended_until?: string;
  total_reports_against?: number;
  pending_reports_against?: number;
  referral_code?: string | null;
  total_referrals?: number;
  recent_referrals?: number;
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
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loadingDiscussions, setLoadingDiscussions] = useState(false);
  const [triggeringDiscussion, setTriggeringDiscussion] = useState(false);
  const [discussionMessage, setDiscussionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  // Beta codes state
  const [betaCodes, setBetaCodes] = useState<any[]>([]);
  const [betaGrants, setBetaGrants] = useState<any[]>([]);
  const [loadingBetaCodes, setLoadingBetaCodes] = useState(false);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkMaxUses, setBulkMaxUses] = useState(1);
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkExpiryDays, setBulkExpiryDays] = useState(30);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

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
      if (statsRes.data) setDatasetStats(statsRes.data);
      if (pairsRes.data) setDatasetPairs(pairsRes.data);
    } catch (e) {
      console.error('Error loading dataset:', e);
    } finally {
      setLoadingDataset(false);
    }
  };

  const loadBetaCodes = async () => {
    setLoadingBetaCodes(true);
    try {
      const [codesRes, grantsRes] = await Promise.all([
        supabase
          .from('invite_codes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('beta_access_grants')
          .select('id, user_id, granted_at, expires_at, status, invite_code_id, profiles(full_name)')
          .order('granted_at', { ascending: false }),
      ]);
      if (codesRes.data) setBetaCodes(codesRes.data);
      if (grantsRes.data) setBetaGrants(grantsRes.data);
    } catch (e) {
      console.error('Error loading beta codes:', e);
    } finally {
      setLoadingBetaCodes(false);
    }
  };

  const generateBetaCodes = async () => {
    setGeneratingCodes(true);
    setGeneratedCodes([]);
    try {
      const expiresAt = new Date(Date.now() + bulkExpiryDays * 24 * 60 * 60 * 1000).toISOString();
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const codes: string[] = [];
      for (let i = 0; i < bulkCount; i++) {
        let code = 'BETA-';
        for (let j = 0; j < 8; j++) code += chars[Math.floor(Math.random() * chars.length)];
        codes.push(code);
      }
      const rows = codes.map(code => ({
        code,
        max_uses: bulkMaxUses,
        use_count: 0,
        expires_at: expiresAt,
        notes: bulkNotes || null,
      }));
      const { error } = await supabase.from('invite_codes').insert(rows);
      if (error) { console.error('Failed to generate codes:', error); return; }
      setGeneratedCodes(codes);
      await loadBetaCodes();
    } catch (e) {
      console.error('generateBetaCodes error:', e);
    } finally {
      setGeneratingCodes(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_admin_all_users');

      if (error) throw error;

      const rows = (data || []) as UserStats[];
      setUsers(rows.map(r => ({ ...r, pods_joined_count: 0 })));
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ verified: !currentStatus })
        .eq('id', userId);

      if (error) {
        console.error('Verification error details:', error);
        throw error;
      }

      console.log('Verification updated successfully:', data);

      setUsers(users.map(user =>
        user.id === userId ? { ...user, verified: !currentStatus } : user
      ));

      alert(`User ${!currentStatus ? 'verified' : 'unverified'} successfully`);
    } catch (error: any) {
      console.error('Error toggling verification:', error);
      alert(`Failed to update verification status: ${error.message || 'Unknown error'}`);
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

    const { data, error } = await supabase.rpc('get_admin_user_workspaces', { target_user_id: user.id });
    if (error) console.error('Error loading user workspaces:', error);
    setUserWorkspaces(data || []);
    setLoadingContributions(false);
  };

  const deleteContentItem = async (_itemId: string, _deleteFunc: string, _itemType: string) => {};

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'all' || user.account_status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const exportToCSV = () => {
    const headers = [
      'Full Name',
      'Email',
      'Username',
      'Status',
      'Verified',
      'Workspaces Created (Now)',
      'Workspaces Opened (Now)',
      'Workspaces Created (All Time)',
      'PDFs Exported',
      'Total Referrals',
      'Joined Date',
    ];

    const rows = filteredUsers.map(user => [
      user.full_name || '',
      user.email || '',
      user.username ? `@${user.username}` : '',
      user.account_status || 'active',
      user.verified ? 'Yes' : 'No',
      user.workspaces_created ?? 0,
      user.workspaces_opened ?? 0,
      user.workspaces_created_alltime ?? 0,
      user.pdfs_exported ?? 0,
      user.total_referrals ?? 0,
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
    } catch (err) {
      console.error('Error loading workspaces:', err);
    }
    setLoadingAdminWorkspaces(false);
  };

  const loadUpgradeRequests = async (filter = upgradeFilter) => {
    setLoadingUpgrades(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-upgrade-requests?status=${filter}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      setUpgradeRequests(json.requests || []);
    } catch {}
    setLoadingUpgrades(false);
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
      const json = await res.json();
      if (json.success) loadUpgradeRequests(upgradeFilter);
    } catch {}
    setProcessingUpgrade(null);
  };

  const loadDiscussions = async () => {
    setLoadingDiscussions(true);
    try {
      const { data } = await supabase
        .from('ai_agent_discussions')
        .select('*, agent_topics(title, domain)')
        .order('created_at', { ascending: false })
        .limit(20);
      setDiscussions(data || []);
    } catch (err) {
      console.error('Error loading discussions:', err);
    } finally {
      setLoadingDiscussions(false);
    }
  };

  const triggerDiscussion = async () => {
    setTriggeringDiscussion(true);
    setDiscussionMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'agent-discussion' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setDiscussionMessage({ type: 'success', text: `Discussion created: "${data.topicTitle}"` });
      await loadDiscussions();
    } catch (err: any) {
      setDiscussionMessage({ type: 'error', text: err.message || 'Failed to trigger discussion' });
    } finally {
      setTriggeringDiscussion(false);
    }
  };

  const totalUsers = users.length;
  const verifiedUsers = users.filter(u => u.verified).length;
  const suspendedUsers = users.filter(u => u.account_status === 'suspended').length;
  const bannedUsers = users.filter(u => u.account_status === 'banned').length;
  const totalReports = users.reduce((sum, u) => sum + (u.total_reports_against || 0), 0);
  const totalReferrals = users.reduce((sum, u) => sum + (u.total_referrals || 0), 0);
  const recentReferrals = users.reduce((sum, u) => sum + (u.recent_referrals || 0), 0);

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
                  onClick={() => { setAdminView('ai-discussions'); loadDiscussions(); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
                    adminView === 'ai-discussions'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  AI Discussions
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
                  <Sparkles className="w-4 h-4" />
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
                <button
                  onClick={() => { setAdminView('beta-codes'); loadBetaCodes(); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-slate-200 ${
                    adminView === 'beta-codes'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  Beta Codes
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
                    <Sparkles className="w-5 h-5 text-amber-600" />
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

        {adminView === 'ai-discussions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">AI Agent Discussions</h2>
                    <p className="text-sm text-slate-500">Trigger multi-agent debates that publish to the feed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadDiscussions}
                    disabled={loadingDiscussions}
                    className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingDiscussions ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={triggerDiscussion}
                    disabled={triggeringDiscussion}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {triggeringDiscussion ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {triggeringDiscussion ? 'Generating...' : 'Trigger Discussion'}
                  </button>
                </div>
              </div>

              {discussionMessage && (
                <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                  discussionMessage.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {discussionMessage.text}
                </div>
              )}

              <p className="text-sm text-slate-500 mb-1">
                Each discussion selects a topic, runs a 6-turn debate between 3 AI agents, and publishes a synthesised insight post to the main feed. The cron job runs automatically every 6 hours.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Recent Discussions ({discussions.length})</h3>
              </div>
              {loadingDiscussions ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : discussions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Bot className="w-12 h-12 mb-3 opacity-30" />
                  <p className="font-medium">No discussions yet</p>
                  <p className="text-sm">Click "Trigger Discussion" to generate the first one</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {discussions.map((d: any) => (
                    <div key={d.id} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{d.topic_title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-500">{new Date(d.created_at).toLocaleString()}</span>
                          {d.agent_topics?.domain && (
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full capitalize">{d.agent_topics.domain}</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            d.discussion_status === 'completed'
                              ? 'bg-green-50 text-green-700 border border-green-100'
                              : d.discussion_status === 'in_progress'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-slate-50 text-slate-600 border border-slate-200'
                          }`}>{d.discussion_status}</span>
                        </div>
                        {d.agent_names && (
                          <p className="text-xs text-slate-400 mt-0.5">{(d.agent_names as string[]).join(' · ')}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-700">{d.turn_count} turns</p>
                        {d.post_id && <p className="text-xs text-green-600 mt-0.5">Post published</p>}
                      </div>
                    </div>
                  ))}
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
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-slate-600">Verified</p>
                <p className="text-2xl font-bold text-slate-900">{verifiedUsers}</p>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <UserPlus className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Total Referrals</p>
                <p className="text-2xl font-bold text-slate-900">{totalReferrals}</p>
                {recentReferrals > 0 && (
                  <p className="text-xs text-blue-600 mt-1">{recentReferrals} this month</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm text-slate-600">User Reports</p>
                <p className="text-2xl font-bold text-slate-900">{totalReports}</p>
              </div>
            </div>
          </div>
        </div>

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
                placeholder="Search users by name, email, or username..."
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Referrals</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reports</th>
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
                                <VerificationBadge verified={user.verified} size="sm" />
                              </div>
                              <p className="text-sm text-slate-600">{user.email}</p>
                              {user.username && (
                                <p className="text-xs text-slate-500">@{user.username}</p>
                              )}
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
                          <div className="text-sm">
                            {user.total_referrals && user.total_referrals > 0 ? (
                              <>
                                <p className="font-semibold text-blue-900">{user.total_referrals} total</p>
                                {user.recent_referrals ? (
                                  <p className="text-xs text-blue-600 mt-0.5">{user.recent_referrals} this month</p>
                                ) : null}
                                {user.referral_code && (
                                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{user.referral_code}</p>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            {user.total_reports_against ? (
                              <>
                                <p className="font-semibold text-red-900">{user.total_reports_against} total</p>
                                {user.pending_reports_against ? (
                                  <p className="text-xs text-red-600 mt-0.5">{user.pending_reports_against} pending</p>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
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

                            <button
                              onClick={() => toggleVerification(user.id, user.verified)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                user.verified
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
                              {user.verified ? (
                                <span className="flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  Unverify
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Verify
                                </span>
                              )}
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

        {adminView === 'beta-codes' && (
          <div className="space-y-5">
            {/* Generate codes */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Generate Invite Codes</h3>
              <div className="grid sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Number of codes</label>
                  <input type="number" min={1} max={500} value={bulkCount} onChange={e => setBulkCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Max uses per code</label>
                  <input type="number" min={1} max={1000} value={bulkMaxUses} onChange={e => setBulkMaxUses(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Code expires in (days)</label>
                  <input type="number" min={1} max={365} value={bulkExpiryDays} onChange={e => setBulkExpiryDays(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notes (optional)</label>
                  <input type="text" value={bulkNotes} onChange={e => setBulkNotes(e.target.value)} placeholder="e.g. ProductHunt launch"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <button onClick={generateBetaCodes} disabled={generatingCodes}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
                {generatingCodes ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><Key className="w-4 h-4" /> Generate {bulkCount} Code{bulkCount !== 1 ? 's' : ''}</>}
              </button>

              {generatedCodes.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-700">Generated {generatedCodes.length} codes — copy and distribute:</p>
                    <button onClick={() => { navigator.clipboard.writeText(generatedCodes.join('\n')); }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold">Copy all</button>
                  </div>
                  <div className="font-mono text-xs text-slate-600 space-y-1 max-h-48 overflow-y-auto">
                    {generatedCodes.map(c => <div key={c} className="flex items-center gap-2"><span>{c}</span></div>)}
                  </div>
                </div>
              )}
            </div>

            {/* Code usage table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">All Invite Codes ({betaCodes.length})</h3>
                <button onClick={loadBetaCodes} disabled={loadingBetaCodes} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                  <RefreshCw className={`w-3 h-3 ${loadingBetaCodes ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              {loadingBetaCodes ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Code', 'Uses', 'Max Uses', 'Expires', 'Notes', 'Created'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {betaCodes.map(c => {
                        const expired = c.expires_at && new Date(c.expires_at) < new Date();
                        const maxed = c.use_count >= c.max_uses;
                        return (
                          <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-800">{c.code}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-600">
                              <span className={`font-semibold ${maxed ? 'text-red-600' : 'text-slate-700'}`}>{c.use_count}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-600">{c.max_uses}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {c.expires_at
                                ? <span className={expired ? 'text-red-500 font-semibold' : 'text-slate-600'}>
                                    {new Date(c.expires_at).toLocaleDateString()}
                                  </span>
                                : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[160px] truncate">{c.notes || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td>
                          </tr>
                        );
                      })}
                      {betaCodes.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">No codes yet. Generate some above.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Grant table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Beta Access Grants ({betaGrants.length})</h3>
              </div>
              {loadingBetaCodes ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['User', 'Status', 'Granted', 'Expires', 'Days Left'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {betaGrants.map((g: any) => {
                        const expiresAt = new Date(g.expires_at);
                        const now = new Date();
                        const msLeft = expiresAt.getTime() - now.getTime();
                        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
                        const isExpired = msLeft <= 0;
                        const profile = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles;
                        return (
                          <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="text-xs font-semibold text-slate-800">{profile?.full_name || '—'}</p>
                              <p className="text-[11px] text-slate-400">{g.user_id.slice(0, 8) + '…'}</p>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full capitalize" style={{
                                background: g.status === 'active' && !isExpired ? 'rgba(22,163,74,0.1)' : 'rgba(15,23,42,0.06)',
                                color: g.status === 'active' && !isExpired ? '#15803d' : '#64748b',
                              }}>
                                {isExpired ? 'expired' : g.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(g.granted_at).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{expiresAt.toLocaleDateString()}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {isExpired
                                ? <span className="text-red-500 font-semibold">Expired</span>
                                : <span className={`font-semibold ${daysLeft <= 7 ? 'text-amber-600' : 'text-slate-700'}`}>{daysLeft}d</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {betaGrants.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No beta grants yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                      <VerificationBadge verified={selectedUser.verified} size="md" />
                    </div>
                    <p className="text-slate-600">{selectedUser.email}</p>
                    {selectedUser.username && (
                      <p className="text-slate-500">@{selectedUser.username}</p>
                    )}
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

              {selectedUser.total_referrals !== undefined && selectedUser.total_referrals > 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-900">
                      Referred {selectedUser.total_referrals} user{selectedUser.total_referrals !== 1 ? 's' : ''}
                    </span>
                    {selectedUser.recent_referrals !== undefined && selectedUser.recent_referrals > 0 && (
                      <span className="text-blue-700">
                        ({selectedUser.recent_referrals} this month)
                      </span>
                    )}
                  </div>
                  {selectedUser.referral_code && (
                    <p className="text-xs text-slate-600 mt-1">
                      Code: <span className="font-mono font-semibold">{selectedUser.referral_code}</span>
                    </p>
                  )}
                </div>
              )}
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
                    <li>All posts, comments, and messages</li>
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
