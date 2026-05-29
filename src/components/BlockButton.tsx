import { useState, useEffect } from 'react';
import { Ban, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface BlockButtonProps {
  userId: string;
  className?: string;
}

export default function BlockButton({ userId, className = '' }: BlockButtonProps) {
  const { user } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && userId) {
      checkBlockStatus();
    }
  }, [user, userId]);

  async function checkBlockStatus() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId)
        .maybeSingle();

      if (error) throw error;
      setIsBlocked(!!data);
    } catch (error) {
      console.error('Error checking block status:', error);
    }
  }

  async function toggleBlock() {
    if (!user || loading) return;

    setLoading(true);
    try {
      if (isBlocked) {
        const { error } = await supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', userId);

        if (error) throw error;
        setIsBlocked(false);
      } else {
        const { error } = await supabase
          .from('user_blocks')
          .insert({
            blocker_id: user.id,
            blocked_id: userId
          });

        if (error) throw error;
        setIsBlocked(true);
      }
    } catch (error) {
      console.error('Error toggling block:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!user || user.id === userId) return null;

  return (
    <button
      onClick={toggleBlock}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 font-medium text-sm ${
        isBlocked
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-red-100 text-red-700 hover:bg-red-200'
      } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isBlocked ? (
        <>
          <Shield className="w-4 h-4" />
          <span>Unblock</span>
        </>
      ) : (
        <>
          <Ban className="w-4 h-4" />
          <span>Block</span>
        </>
      )}
    </button>
  );
}
