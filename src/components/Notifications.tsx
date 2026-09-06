import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Heart, MessageSquare, X, UserPlus, User, AtSign, Target, CheckCircle, ThumbsUp, Flame, Reply, Bot, UserCheck, Users, AlertTriangle, RotateCcw, ShieldAlert, ShieldCheck, Building2 } from 'lucide-react';
import { SkeletonNotification } from './Skeleton';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { throttle } from '../lib/throttle';
import { getAvatarUrl } from '../lib/avatarUtils';

interface Notification {
  id: string;
  type: 'reaction' | 'comment' | 'pod_invite' | 'follow' | 'mention' | 'referral' | 'forecast_resolved' | 'account_deletion_requested' | 'account_restored' | string;
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
  onNavigate: (
    page: string,
    idParam?: string,
    userId?: string,
    editMode?: boolean,
    initialTab?: string,
  ) => void;
}

export default function Notifications({ onNavigate }: NotificationsProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
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

  async function dismissNotification(notificationId: string) {
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
    } else if (notification.type === 'workspace_agents_responded') {
      onNavigate('workspaces');
    } else if (notification.type === 'workspace_invite_accepted') {
      onNavigate('workspaces');
    } else if (notification.type === 'workspace_team_message' || notification.type === 'workspace_team_mention') {
      if (notification.related_id) {
        onNavigate('workspace-hub', notification.related_id, undefined, undefined, 'team');
      } else {
        onNavigate('workspaces');
      }
    } else if (notification.type === 'workspace_ai_activity') {
      if (notification.related_id) {
        onNavigate('workspace-hub', notification.related_id);
      } else {
        onNavigate('workspaces');
      }
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
      case 'workspace_agents_responded':
        return <Bot className="w-4 h-4" />;
      case 'workspace_invite_accepted':
        return <UserCheck className="w-4 h-4" />;
      case 'workspace_team_message':
        return <Users className="w-4 h-4" />;
      case 'workspace_team_mention':
        return <AtSign className="w-4 h-4" />;
      case 'workspace_ai_activity':
        return <Bot className="w-4 h-4" />;
      case 'account_deletion_requested':
        return <AlertTriangle className="w-4 h-4" />;
      case 'account_restored':
        return <RotateCcw className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  }

  function getIconColors(type: string) {
    switch (type) {
      case 'reaction': return 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400';
      case 'follow': return 'bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400';
      case 'mention': return 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400';
      case 'referral': return 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400';
      case 'forecast_resolved': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400';
      case 'entity_challenged': return 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400';
      case 'challenge_upvoted': return 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400';
      case 'challenge_replied': return 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400';
      case 'workspace_agents_responded': return 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400';
      case 'workspace_invite_accepted': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400';
      case 'workspace_team_message': return 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400';
      case 'workspace_team_mention': return 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400';
      case 'workspace_ai_activity': return 'bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400';
      case 'account_deletion_requested': return 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400';
      case 'account_restored': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400';
      default: return 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400';
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
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-white/10"
        style={{ color: theme === 'dark' ? '#71717a' : '#64748b' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = theme === 'dark' ? '#fbbf24' : '#d97706'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = theme === 'dark' ? '#71717a' : '#64748b'; }}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => setIsOpen(false)}
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]"
            style={{ borderLeft: '1px solid rgba(148,163,184,0.2)' }}
          >
            <style>{`
              @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}</style>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[1, 2, 3].map(i => <SkeletonNotification key={i} />)}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-slate-100 dark:bg-slate-800">
                    <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">All caught up!</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">New activity will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`relative px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        !notification.is_read ? 'bg-blue-50 dark:bg-blue-500/5' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        aria-label="Delete notification"
                      >
                        <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
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
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <User className="w-5 h-5 text-white" />
                          </div>
                        ) : (
                          <div className={`mt-0.5 p-2 rounded-full flex-shrink-0 ${getIconColors(notification.type)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug">
                            {notification.actor?.full_name && (
                              <span className="text-blue-600 dark:text-blue-400 font-semibold">{notification.actor.full_name} </span>
                            )}
                            {notification.title.replace(notification.actor?.full_name || '', '').trim()}
                          </p>
                          {notification.content && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {notification.content}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {formatTime(notification.created_at)}
                          </p>

                          {notification.type === 'follow' && notification.actor_id && (
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismissNotification(notification.id);
                                }}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              >
                                Dismiss
                              </button>
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
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
