import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Check, X, User, Calendar, MapPin, Mail, MessageSquare, FileText } from 'lucide-react';
import { getDisplayName } from '../lib/displayName';

interface VerificationRequest {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  location: string;
  country: string;
  bio: string;
  avatar_url: string;
  verification_requested_at: string;
  created_at: string;
  email: string;
  posts_count: number;
  comments_count: number;
}

export default function Admin() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  async function checkAdminStatus() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('admins')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking admin status:', error);
        setLoading(false);
        return;
      }

      const isAdminUser = !!data;
      setIsAdmin(isAdminUser);

      if (isAdminUser) {
        loadVerificationRequests();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setLoading(false);
    }
  }

  async function loadVerificationRequests() {
    try {
      setLoading(true);

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          first_name,
          last_name,
          location,
          country,
          bio,
          avatar_url,
          verification_requested_at,
          created_at
        `)
        .not('verification_requested_at', 'is', null)
        .order('verification_requested_at', { ascending: true });

      if (profileError) throw profileError;

      // Get email addresses from auth.users
      const userIds = profiles?.map(p => p.id) || [];
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) throw authError;

      // Get activity counts
      const requestsWithDetails = await Promise.all(
        (profiles || []).map(async (profile) => {
          const authUser = authUsers.users.find(u => u.id === profile.id);

          const { count: postsCount } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', profile.id);

          const { count: commentsCount } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', profile.id);

          return {
            ...profile,
            email: authUser?.email || 'N/A',
            posts_count: postsCount || 0,
            comments_count: commentsCount || 0,
          };
        })
      );

      setRequests(requestsWithDetails);
    } catch (error) {
      console.error('Error loading verification requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(userId: string) {
    if (!user) return;

    try {
      setProcessing(userId);

      const { data, error } = await supabase.rpc('approve_verification', {
        target_user_id: userId,
        admin_user_id: user.id,
      });

      if (error) throw error;

      if (data.success) {
        setRequests(requests.filter(r => r.id !== userId));
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error approving verification:', error);
      alert('Failed to approve verification');
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(userId: string) {
    if (!user) return;

    try {
      setProcessing(userId);

      const { data, error } = await supabase.rpc('reject_verification', {
        target_user_id: userId,
        admin_user_id: user.id,
      });

      if (error) throw error;

      if (data.success) {
        setRequests(requests.filter(r => r.id !== userId));
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error rejecting verification:', error);
      alert('Failed to reject verification');
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You do not have admin privileges</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-500" />
          Verification Requests
        </h1>
        <p className="text-gray-600 mt-2">
          Review and approve user verification requests
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Requests</h3>
          <p className="text-gray-600">There are no verification requests to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  {request.avatar_url ? (
                    <img
                      src={request.avatar_url}
                      alt={request.full_name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-10 h-10 text-blue-600" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {getDisplayName(request)}
                      </h3>
                      {request.email && (
                        <p className="text-gray-600">{request.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      {request.email}
                    </div>
                    {(request.location || request.country) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        {[request.location, request.country].filter(Boolean).join(', ')}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      Joined {new Date(request.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      Requested {new Date(request.verification_requested_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="w-4 h-4" />
                      <span className="font-semibold">{request.posts_count}</span> posts
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MessageSquare className="w-4 h-4" />
                      <span className="font-semibold">{request.comments_count}</span> comments
                    </div>
                  </div>

                  {request.bio && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{request.bio}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={processing === request.id}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      disabled={processing === request.id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
