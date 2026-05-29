import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, UserCheck, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl, getInitials } from '../lib/avatarUtils';
import { getDisplayName } from '../lib/displayName';

interface SuggestedUser {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  job_title: string | null;
  verified: boolean;
}

interface WhoToFollowProps {
  onNavigate: (page: string, podId?: string, userId?: string) => void;
}

export default function WhoToFollow({ onNavigate }: WhoToFollowProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    if (!user) return;
    try {
      const { data: alreadyFollowing } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = new Set((alreadyFollowing || []).map(f => f.following_id));
      setFollowing(followingIds);

      const exclude = [user.id, ...Array.from(followingIds)];

      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, username, avatar_url, job_title, verified')
        .not('id', 'in', `(${exclude.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(5);

      setSuggestions(users || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow(targetId: string) {
    if (!user || loadingIds.has(targetId)) return;
    setLoadingIds(prev => new Set(prev).add(targetId));

    try {
      if (following.has(targetId)) {
        await supabase.from('followers').delete().eq('follower_id', user.id).eq('following_id', targetId);
        setFollowing(prev => { const n = new Set(prev); n.delete(targetId); return n; });
      } else {
        await supabase.from('followers').insert({ follower_id: user.id, following_id: targetId });
        setFollowing(prev => new Set(prev).add(targetId));
      }
    } catch {
    } finally {
      setLoadingIds(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    }
  }

  if (!user || loading || suggestions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Who to follow</span>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {suggestions.map(u => {
          const name = getDisplayName(u);
          const avatarUrl = getAvatarUrl(u.avatar_url);
          const isFollowing = following.has(u.id);
          const isLoading = loadingIds.has(u.id);

          return (
            <div key={u.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
              <button
                onClick={() => onNavigate('profile', undefined, u.id)}
                className="flex-shrink-0"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold ring-1 ring-slate-200">
                    {getInitials(name)}
                  </div>
                )}
              </button>

              <button
                onClick={() => onNavigate('profile', undefined, u.id)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-800 truncate leading-tight">
                    {name}
                  </span>
                  {u.verified && (
                    <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.7 6.7l-4 4a1 1 0 01-1.4 0l-2-2a1 1 0 011.4-1.4l1.3 1.3 3.3-3.3a1 1 0 011.4 1.4z" />
                    </svg>
                  )}
                </div>
                {u.job_title && (
                  <p className="text-xs text-slate-500 truncate mt-0.5">{u.job_title}</p>
                )}
              </button>

              <button
                onClick={() => toggleFollow(u.id)}
                disabled={isLoading}
                className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                  isFollowing
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isFollowing ? (
                  <><UserCheck className="w-3 h-3" />Following</>
                ) : (
                  <><UserPlus className="w-3 h-3" />Follow</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => onNavigate('profile')}
        className="w-full px-4 py-3 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 border-t border-slate-100"
      >
        Find more people
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
