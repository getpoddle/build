import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import VerificationBadge from './VerificationBadge';

interface User {
  id: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  verified: boolean | null;
}

interface UserListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
  onUserClick: (userId: string) => void;
}

export default function UserListModal({ isOpen, onClose, userId, type, onUserClick }: UserListModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, userId, type]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      if (type === 'followers') {
        const { data, error } = await supabase
          .from('followers')
          .select(`
            follower_id,
            profiles:follower_id (
              id,
              full_name,
              bio,
              avatar_url,
              verified
            )
          `)
          .eq('following_id', userId);

        if (error) throw error;
        setUsers(data?.map(f => f.profiles as unknown as User).filter(Boolean) || []);
      } else {
        const { data, error } = await supabase
          .from('followers')
          .select(`
            following_id,
            profiles:following_id (
              id,
              full_name,
              bio,
              avatar_url,
              verified
            )
          `)
          .eq('follower_id', userId);

        if (error) throw error;
        setUsers(data?.map(f => f.profiles as unknown as User).filter(Boolean) || []);
      }
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-md w-full max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {type === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">
                {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => {
                    onUserClick(user.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg transition text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden">
                    {getAvatarUrl(user.avatar_url) ? (
                      <img
                        src={getAvatarUrl(user.avatar_url)!}
                        alt={user.full_name || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 font-semibold text-lg">
                        {user.full_name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {user.full_name || 'Anonymous User'}
                      </h3>
                      <VerificationBadge verified={user.verified || false} size="sm" />
                    </div>
                    {user.bio && (
                      <p className="text-sm text-slate-600 truncate">{user.bio}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
