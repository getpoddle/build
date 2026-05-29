import { useEffect, useState, useRef, useCallback } from 'react';
import { Bell, Heart, MessageSquare, X, UserPlus, User, AtSign, Target, CheckCircle, ThumbsUp, Flame, Reply } from 'lucide-react';
import { SkeletonNotification } from './Skeleton';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { throttle } from '../lib/throttle';
import { getAvatarUrl } from '../lib/avatarUtils';

interface Notification {
  id: string;
  type: 'reaction' | 'comment' | 'pod_invite' | 'follow' | 'mention' | 'referral' | 'forecast_resolved' | string;
  title: string;
  content: string;
  related_id: string | null;
  related_type: string | null;
  actor_id: string | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface NotificationsProps {
  onNavigate: (page: string) => void;
}

export default function Notifications({ onNavigate }: NotificationsProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchUnreadCount();

    const handleInsert = throttle(async (payload: any) => {
      const newNotification = payload.new as Notification;

      const { data: notificationWithActor } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id (
            full_name,
            avatar_url
          )
        `)
        .eq('id', newNotification.id)
        .maybeSingle();

      if (notificationWithActor) {
        setNotifications((prev) => [notificationWithActor, ...prev]);
        setUnreadCount((prev) => prev + 1);

        if (notificationWithActor.type === 'follow' && notificationWithActor.actor_id) {
          checkFollowingStatus([notificationWithActor.actor_id]);
        }
      }
    }, 500);

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        handleInsert
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? { ...n, ...updatedNotification } : n))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const deletedNotification = payload.old as Notification;
          setNotifications((prev) => prev.filter((n) => n.id !== deletedNotification.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchNotifications() {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:actor_id (
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);

      const followNotifications = (data || []).filter(n => n.type === 'follow' && n.actor_id);
      if (followNotifications.length > 0) {
        await checkFollowingStatus(followNotifications.map(n => n.actor_id!));
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkFollowingStatus(userIds: string[]) {
    if (!user || userIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', userIds);

      if (error) throw error;

      const followingSet = new Set((data || []).map(f => f.following_id));
      const newFollowingMap: Record<string, boolean> = {};
      userIds.forEach(id => {
        newFollowingMap[id] = followingSet.has(id);
      });
      setFollowingMap(newFollowingMap);
    } catch (error) {
      console.error('Error checking following status:', error);
    }
  }

  async function fetchUnreadCount() {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async function markAllAsRead() {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  async function deleteNotification(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  async function followBack(userId: string, notificationId: string) {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('followers')
        .insert({
          follower_id: user.id,
          following_id: userId
        });

      if (error) throw error;

      setFollowingMap(prev => ({ ...prev, [userId]: true }));
      await markAsRead(notificationId);
    } catch (error) {
      console.error('Error following back:', error);
    }
  }

  async function dismissFollowNotification(notificationId: string) {
    await markAsRead(notificationId);
  }

  function handleNotificationClick(notification: Notification) {
    markAsRead(notification.id);
    setIsOpen(false);

    if (notification.type === 'entity_challenged' || notification.type === 'challenge_upvoted' || notification.type === 'challenge_replied') {
      if (notification.related_id && notification.related_type) {
        window.location.hash = `entity/${notification.related_type}/${notification.related_id}`;
      } else {
        onNavigate('reasoning');
      }
    } else if (notification.type === 'comment' || notification.type === 'reaction') {
      onNavigate('pods');
    } else if (notification.type === 'mention') {
      onNavigate('pods');
    } else if (notification.type === 'follow') {
      onNavigate('profile');
    } else if (notification.type === 'referral') {
      onNavigate('profile');
    } else if (notification.type === 'forecast_resolved') {
      onNavigate('pods');
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'reaction':
        return <Heart className="w-4 h-4" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4" />;
      case 'follow':
        return <UserPlus className="w-4 h-4" />;
      case 'mention':
        return <AtSign className="w-4 h-4" />;
      case 'referral':
        return <Target className="w-4 h-4" />;
      case 'forecast_resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'entity_challenged':
        return <Flame className="w-4 h-4" />;
      case 'challenge_upvoted':
        return <ThumbsUp className="w-4 h-4" />;
      case 'challenge_replied':
        return <Reply className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  }

  function formatTime(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-slate-200 z-[60] max-h-[600px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {[1, 2, 3].map(i => <SkeletonNotification key={i} />)}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: 'rgba(241,245,249,0.9)' }}
                >
                  <Bell className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">All caught up!</p>
                <p className="text-xs text-slate-400">New activity will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer relative ${
                      !notification.is_read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="absolute top-2 right-2 p-1 hover:bg-slate-200 rounded"
                    >
                      <X className="w-4 h-4 text-slate-400" />
                    </button>

                    <div className="flex items-start gap-3">
                      {notification.actor?.avatar_url ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 mt-1">
                          <img
                            src={getAvatarUrl(notification.actor.avatar_url) || ''}
                            alt={notification.actor.full_name || 'User'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : notification.actor ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center flex-shrink-0 mt-1">
                          <User className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <div
                          className={`mt-1 p-2 rounded-full ${
                            notification.type === 'reaction'
                              ? 'bg-red-100 text-red-600'
                              : notification.type === 'follow'
                              ? 'bg-teal-100 text-teal-600'
                              : notification.type === 'mention'
                              ? 'bg-amber-100 text-amber-600'
                              : notification.type === 'referral'
                              ? 'bg-sky-100 text-sky-600'
                              : notification.type === 'forecast_resolved'
                              ? 'bg-emerald-100 text-emerald-600'
                              : notification.type === 'entity_challenged'
                              ? 'bg-orange-100 text-orange-600'
                              : notification.type === 'challenge_upvoted'
                              ? 'bg-blue-100 text-blue-600'
                              : notification.type === 'challenge_replied'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {getNotificationIcon(notification.type)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {notification.actor?.full_name && (
                            <span className="text-blue-600 font-semibold">{notification.actor.full_name}</span>
                          )}
                          {notification.actor?.full_name && ' '}
                          {notification.title.replace(notification.actor?.full_name || '', '').trim()}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatTime(notification.created_at)}
                        </p>

                        {notification.type === 'follow' && notification.actor_id && (
                          <div className="flex gap-2 mt-3">
                            {!followingMap[notification.actor_id] ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    followBack(notification.actor_id!, notification.id);
                                  }}
                                  className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  Follow Back
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dismissFollowNotification(notification.id);
                                  }}
                                  className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                  Dismiss
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-500 italic">
                                Following
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
