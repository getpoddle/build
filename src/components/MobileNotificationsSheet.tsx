import { useEffect, useState } from 'react';
import { Bell, Heart, MessageSquare, UserPlus, User, AtSign, Target, X } from 'lucide-react';
import { SkeletonNotification } from './Skeleton';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../lib/avatarUtils';

interface Notification {
  id: string;
  type: 'reaction' | 'comment' | 'pod_invite' | 'follow' | 'mention' | 'referral' | string;
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

interface Props {
  onNavigate: (page: string) => void;
  onUnreadCountChange: (count: number) => void;
}

export default function MobileNotificationsContent({ onNavigate, onUnreadCountChange }: Props) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  async function fetchNotifications() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`*, actor:actor_id (full_name, avatar_url)`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setNotifications(data || []);

      const unread = (data || []).filter(n => !n.is_read).length;
      onUnreadCountChange(unread);

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
      const { data } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', userIds);

      const followingSet = new Set((data || []).map(f => f.following_id));
      const map: Record<string, boolean> = {};
      userIds.forEach(id => { map[id] = followingSet.has(id); });
      setFollowingMap(map);
    } catch {}
  }

  async function markAsRead(notificationId: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    setNotifications(prev => {
      const updated = prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
      onUnreadCountChange(updated.filter(n => !n.is_read).length);
      return updated;
    });
  }

  async function markAllAsRead() {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, is_read: true }));
      onUnreadCountChange(0);
      return updated;
    });
  }

  async function deleteNotification(notificationId: string) {
    await supabase.from('notifications').delete().eq('id', notificationId);
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== notificationId);
      onUnreadCountChange(updated.filter(n => !n.is_read).length);
      return updated;
    });
  }

  async function followBack(userId: string, notificationId: string) {
    if (!user) return;
    try {
      await supabase.from('followers').insert({ follower_id: user.id, following_id: userId });
      setFollowingMap(prev => ({ ...prev, [userId]: true }));
      await markAsRead(notificationId);
    } catch {}
  }

  function handleNotificationClick(notification: Notification) {
    markAsRead(notification.id);
    if (['comment', 'reaction', 'mention'].includes(notification.type)) onNavigate('home');
    else if (['follow', 'referral'].includes(notification.type)) onNavigate('profile');
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'reaction': return <Heart className="w-4 h-4" />;
      case 'comment': return <MessageSquare className="w-4 h-4" />;
      case 'follow': return <UserPlus className="w-4 h-4" />;
      case 'mention': return <AtSign className="w-4 h-4" />;
      case 'referral': return <Target className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  }

  function getIconColors(type: string) {
    switch (type) {
      case 'reaction': return 'bg-red-100 text-red-600';
      case 'follow': return 'bg-teal-100 text-teal-600';
      case 'mention': return 'bg-amber-100 text-amber-600';
      case 'referral': return 'bg-green-100 text-green-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  }

  function formatTime(timestamp: string) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      {unreadCount > 0 && (
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
          <span className="text-sm text-slate-500">{unreadCount} unread</span>
          <button onClick={markAllAsRead} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            Mark all read
          </button>
        </div>
      )}

      {loading ? (
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4].map(i => <SkeletonNotification key={i} />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(241,245,249,0.9)' }}>
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
              onClick={() => handleNotificationClick(notification)}
              className={`relative px-5 py-4 active:bg-slate-50 transition-colors cursor-pointer ${
                !notification.is_read ? 'bg-blue-50/60' : ''
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                className="absolute top-3 right-3 p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <div className="flex items-start gap-3 pr-6">
                {notification.actor?.avatar_url ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                    <img
                      src={getAvatarUrl(notification.actor.avatar_url) || ''}
                      alt={notification.actor.full_name || 'User'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : notification.actor ? (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <div className={`mt-0.5 p-2 rounded-full flex-shrink-0 ${getIconColors(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 leading-snug">
                    {notification.actor?.full_name && (
                      <span className="text-blue-600 font-semibold">{notification.actor.full_name} </span>
                    )}
                    {notification.title.replace(notification.actor?.full_name || '', '').trim()}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{formatTime(notification.created_at)}</p>

                  {notification.type === 'follow' && notification.actor_id && (
                    <div className="flex gap-2 mt-2.5">
                      {!followingMap[notification.actor_id] ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); followBack(notification.actor_id!, notification.id); }}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Follow Back
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                            className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Following</span>
                      )}
                    </div>
                  )}
                </div>

                {!notification.is_read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
