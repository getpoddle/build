import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface FollowButtonProps {
  userId?: string;
  userName?: string;
  targetUserId?: string;
  currentUserId?: string;
  variant?: 'default' | 'compact' | 'profile';
  onFollowChange?: () => void;
}

export default function FollowButton({
  userId: legacyUserId,
  userName,
  targetUserId: propTargetUserId,
  currentUserId: propCurrentUserId,
  variant = 'default',
  onFollowChange,
}: FollowButtonProps) {
  const { user } = useAuth();
  const userId = propTargetUserId || legacyUserId;
  const currentUser = propCurrentUserId || user?.id;
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (currentUser && userId && currentUser !== userId) {
      supabase
        .from('followers')
        .select('id')
        .eq('follower_id', currentUser)
        .eq('following_id', userId)
        .maybeSingle()
        .then(({ data }) => setIsFollowing(!!data))
        .catch(() => {})
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, [currentUser, userId]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || loading || !userId) return;
    setLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentUser)
          .eq('following_id', userId);
        if (error) throw error;
        setIsFollowing(false);
      } else {
        const { error } = await supabase
          .from('followers')
          .insert({ follower_id: currentUser, following_id: userId });
        if (error) throw error;
        setIsFollowing(true);
      }
      onFollowChange?.();
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser || currentUser === userId || checking) return null;

  const displayName = userName ? `@${userName}` : 'this user';
  const ariaLabel = isFollowing ? `Unfollow ${displayName}` : `Follow ${displayName}`;
  const baseDisabled = 'disabled:opacity-50 disabled:cursor-not-allowed';
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500';

  if (variant === 'profile') {
    return (
      <button
        onClick={handleFollow}
        disabled={loading}
        aria-label={ariaLabel}
        aria-pressed={isFollowing}
        className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-semibold transition-all ${
          isFollowing
            ? 'bg-white/20 backdrop-blur text-white hover:bg-white/30'
            : 'bg-white text-blue-600 hover:bg-white/90'
        } ${baseDisabled} ${focusRing}`}
      >
        {isFollowing ? (
          <><UserCheck className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Following</span></>
        ) : (
          <><UserPlus className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Follow</span></>
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleFollow}
        disabled={loading}
        aria-label={ariaLabel}
        aria-pressed={isFollowing}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
          isFollowing
            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        } ${baseDisabled} ${focusRing}`}
      >
        {isFollowing ? (
          <><UserCheck className="w-4 h-4" aria-hidden="true" />Following</>
        ) : (
          <><UserPlus className="w-4 h-4" aria-hidden="true" />Follow</>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      aria-label={ariaLabel}
      aria-pressed={isFollowing}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-colors ${
        isFollowing
          ? 'border border-slate-700 text-slate-700 hover:bg-slate-100'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      } ${baseDisabled} ${focusRing}`}
    >
      {isFollowing ? (
        <><UserCheck className="w-5 h-5" aria-hidden="true" />Following</>
      ) : (
        <><UserPlus className="w-5 h-5" aria-hidden="true" />Follow</>
      )}
    </button>
  );
}
